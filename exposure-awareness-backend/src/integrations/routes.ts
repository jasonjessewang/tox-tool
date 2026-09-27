import { Router } from "express";
import { db } from "../db.ts";
import { requireApiKey, userIdOf, type AuthedRequest } from "../auth.ts";
import { encrypt, decrypt, signState, verifyState } from "./crypto.ts";
import { METRICS, ON_DEVICE_SOURCES, type MetricKey, type NormalizedSample } from "./types.ts";
import * as strava from "./strava.ts";
import * as google from "./google.ts";

interface ProviderInfo {
  id: string;
  name: string;
  mode: "server_oauth" | "on_device" | "identity";
  configured: boolean;
  note: string;
}

function providers(): ProviderInfo[] {
  return [
    { id: "strava", name: "Strava", mode: "server_oauth", configured: strava.stravaConfigured(), note: "Imports your activity time." },
    { id: "google", name: "Google account", mode: "identity", configured: google.googleConfigured(), note: "Sign-in only. Never reads Gmail." },
    { id: "apple_health", name: "Apple Health", mode: "on_device", configured: true, note: "Read on the iPhone by the app; pushed to /v1/ingest/samples." },
    { id: "health_connect", name: "Health Connect (incl. Samsung Health)", mode: "on_device", configured: true, note: "Samsung Health syncs into Health Connect on Android." },
  ];
}

const HTML = (msg: string) => `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><body style="font-family:-apple-system,sans-serif;padding:32px;text-align:center"><h2>${msg}</h2><p>You can close this tab and return to the app.</p>`;

function upsertAccount(userId: string, provider: string, f: { external_id?: string; label?: string; access?: string; refresh?: string; expires_at?: number; scopes?: string }) {
  db.prepare(
    `INSERT INTO integration_accounts (user_id, provider, external_id, label, access_token_enc, refresh_token_enc, expires_at, scopes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, provider) DO UPDATE SET external_id=excluded.external_id, label=excluded.label,
       access_token_enc=excluded.access_token_enc, refresh_token_enc=excluded.refresh_token_enc,
       expires_at=excluded.expires_at, scopes=excluded.scopes`
  ).run(userId, provider, f.external_id ?? null, f.label ?? null, f.access ? encrypt(f.access) : null, f.refresh ? encrypt(f.refresh) : null, f.expires_at ?? null, f.scopes ?? null);
}

export function insertSamples(userId: string, samples: NormalizedSample[]): number {
  const stmt = db.prepare(
    `INSERT INTO metric_samples (user_id, source, metric, sample_date, value, unit, external_id) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, source, external_id) DO UPDATE SET value = excluded.value, sample_date = excluded.sample_date`
  );
  let n = 0;
  for (const s of samples) {
    stmt.run(userId, s.source, s.metric, s.date, s.value, s.unit ?? METRICS[s.metric].unit, s.external_id);
    n++;
  }
  return n;
}

export function buildIntegrationsRouter(): Router {
  const r = Router();

  r.get("/integrations", requireApiKey("read"), (req: AuthedRequest, res) => {
    const userId = userIdOf(req);
    const rows = db.prepare("SELECT provider, label, last_sync FROM integration_accounts WHERE user_id = ?").all(userId) as { provider: string; label: string | null; last_sync: string | null }[];
    const byProvider = new Map(rows.map((x) => [x.provider, x]));
    res.json({
      data: providers().map((p) => ({ ...p, connected: byProvider.has(p.id), account: byProvider.get(p.id)?.label ?? null, last_sync: byProvider.get(p.id)?.last_sync ?? null })),
    });
  });

  r.post("/integrations/:provider/authorize", requireApiKey("write"), (req: AuthedRequest, res) => {
    const userId = userIdOf(req);
    const { provider } = req.params;
    if (provider === "strava" && strava.stravaConfigured()) {
      res.json({ url: strava.buildAuthorizeUrl(signState(userId, "strava")) });
    } else if (provider === "google" && google.googleConfigured()) {
      res.json({ url: google.buildAuthorizeUrl(signState(userId, "google")) });
    } else {
      res.status(400).json({ error: `${provider} is not available or not configured on this server` });
    }
  });

  // Browser redirect target -- no API key here; authenticity comes from the signed, expiring `state`.
  r.get("/integrations/:provider/callback", async (req, res) => {
    const state = verifyState(String(req.query.state ?? ""));
    const code = String(req.query.code ?? "");
    if (!state || state.provider !== req.params.provider || !code) {
      res.status(400).send(HTML("This link is invalid or expired."));
      return;
    }
    try {
      if (state.provider === "strava") {
        const t = await strava.exchangeCode(code);
        upsertAccount(state.userId, "strava", { external_id: String(t.athlete?.id ?? ""), label: t.athlete?.firstname ?? "Strava athlete", access: t.access_token, refresh: t.refresh_token, expires_at: t.expires_at, scopes: "activity:read" });
      } else if (state.provider === "google") {
        const id = await google.exchangeForIdentity(code);
        upsertAccount(state.userId, "google", { external_id: id.sub, label: id.email, scopes: "openid email profile" });
      } else {
        res.status(400).send(HTML("Unknown provider."));
        return;
      }
      res.send(HTML("Connected"));
    } catch (e) {
      console.error("callback failed", e);
      res.status(502).send(HTML("Couldn't complete the connection."));
    }
  });

  r.post("/integrations/strava/sync", requireApiKey("write"), async (req: AuthedRequest, res) => {
    const userId = userIdOf(req);
    const acct = db.prepare("SELECT * FROM integration_accounts WHERE user_id = ? AND provider = 'strava'").get(userId) as any;
    if (!acct) {
      res.status(404).json({ error: "Strava is not connected" });
      return;
    }
    try {
      let access = decrypt(acct.access_token_enc);
      if (acct.expires_at && acct.expires_at * 1000 < Date.now() + 60_000) {
        const t = await strava.refreshTokens(decrypt(acct.refresh_token_enc));
        upsertAccount(userId, "strava", { external_id: acct.external_id, label: acct.label, access: t.access_token, refresh: t.refresh_token, expires_at: t.expires_at, scopes: acct.scopes });
        access = t.access_token;
      }
      const after = acct.last_sync ? Math.floor(Date.parse(acct.last_sync) / 1000) - 86400 : Math.floor(Date.now() / 1000) - 30 * 86400;
      const imported = insertSamples(userId, strava.normalizeActivities(await strava.fetchActivities(access, after)));
      db.prepare("UPDATE integration_accounts SET last_sync = ? WHERE user_id = ? AND provider = 'strava'").run(new Date().toISOString(), userId);
      res.json({ imported });
    } catch (e) {
      console.error("strava sync failed", e);
      res.status(502).json({ error: "Strava sync failed" });
    }
  });

  r.delete("/integrations/:provider", requireApiKey("write"), async (req: AuthedRequest, res) => {
    const userId = userIdOf(req);
    const { provider } = req.params;
    const acct = db.prepare("SELECT * FROM integration_accounts WHERE user_id = ? AND provider = ?").get(userId, provider) as any;
    if (!acct) {
      res.status(404).json({ error: "Not connected" });
      return;
    }
    if (provider === "strava" && acct.access_token_enc) await strava.deauthorize(decrypt(acct.access_token_enc));
    db.prepare("DELETE FROM integration_accounts WHERE user_id = ? AND provider = ?").run(userId, provider);
    if (req.query.purge === "true") db.prepare("DELETE FROM metric_samples WHERE user_id = ? AND source = ?").run(userId, provider);
    res.status(204).send();
  });

  // On-device sources (Apple Health, Health Connect / Samsung Health) push here.
  r.post("/ingest/samples", requireApiKey("write"), (req: AuthedRequest, res) => {
    const userId = userIdOf(req);
    const list = Array.isArray(req.body?.samples) ? req.body.samples : null;
    if (!list || list.length === 0 || list.length > 1000) {
      res.status(400).json({ error: "samples must be an array of 1-1000 items" });
      return;
    }
    const clean: NormalizedSample[] = [];
    for (const s of list) {
      const okSource = (ON_DEVICE_SOURCES as readonly string[]).includes(s?.source);
      const okMetric = s?.metric in METRICS;
      const okDate = /^\d{4}-\d{2}-\d{2}$/.test(String(s?.date ?? ""));
      if (!okSource || !okMetric || !okDate || typeof s.value !== "number" || !Number.isFinite(s.value)) {
        res.status(400).json({ error: "invalid sample", sample: s });
        return;
      }
      clean.push({ source: s.source, metric: s.metric as MetricKey, date: s.date, value: s.value, unit: s.unit, external_id: s.external_id ?? `${s.source}:${s.metric}:${s.date}` });
    }
    res.status(201).json({ imported: insertSamples(userId, clean) });
  });

  r.get("/metrics/daily", requireApiKey("read"), (req: AuthedRequest, res) => {
    const userId = userIdOf(req);
    const since = String(req.query.since ?? "0000-01-01");
    const until = String(req.query.until ?? "9999-12-31");
    const rows = db
      .prepare(
        `SELECT sample_date AS date, metric, SUM(value) AS total, AVG(value) AS mean, GROUP_CONCAT(DISTINCT source) AS sources
         FROM metric_samples WHERE user_id = ? AND sample_date >= ? AND sample_date <= ?
         GROUP BY sample_date, metric ORDER BY sample_date DESC, metric`
      )
      .all(userId, since, until) as { date: string; metric: MetricKey; total: number; mean: number; sources: string }[];
    res.json({
      data: rows.map((x) => ({
        date: x.date,
        metric: x.metric,
        value: Math.round((METRICS[x.metric].aggregate === "sum" ? x.total : x.mean) * 10) / 10,
        unit: METRICS[x.metric].unit,
        sources: x.sources.split(","),
      })),
    });
  });

  return r;
}
