import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApp } from "./harness.ts";

let ctx: Awaited<ReturnType<typeof startApp>>;
const realFetch = globalThis.fetch;
const outbound: string[] = [];

before(async () => {
  ctx = await startApp("test-integrations");
  process.env.STRAVA_CLIENT_ID = "cid";
  process.env.STRAVA_CLIENT_SECRET = "csecret";
  process.env.STRAVA_REDIRECT_URI = "http://localhost/cb";
  // Only intercept calls to Strava; the test's own HTTP calls to the local server pass through.
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input);
    if (!url.startsWith("https://www.strava.com")) return realFetch(input, init);
    outbound.push(url);
    if (url.includes("/oauth/token")) {
      return new Response(JSON.stringify({ access_token: "AT1", refresh_token: "RT1", expires_at: Math.floor(Date.now() / 1000) + 3600, athlete: { id: 42, firstname: "Sam" } }));
    }
    if (url.includes("/athlete/activities")) {
      return new Response(JSON.stringify([
        { id: 1, moving_time: 1800, start_date_local: "2026-06-01T07:00:00Z" },
        { id: 2, moving_time: 900, start_date_local: "2026-06-01T18:00:00Z" },
        { id: 3, moving_time: 0, start_date_local: "2026-06-02T18:00:00Z" },
      ]));
    }
    return new Response("{}");
  }) as typeof fetch;
});
after(async () => {
  globalThis.fetch = realFetch;
  await ctx.stop();
});

test("crypto: tokens round-trip, tampering is rejected, state expires and is unforgeable", async () => {
  const { encrypt, decrypt, signState, verifyState } = await import("../src/integrations/crypto.ts");
  assert.equal(decrypt(encrypt("secret-token")), "secret-token");
  assert.notEqual(encrypt("secret-token"), encrypt("secret-token"));
  const enc = encrypt("x");
  assert.throws(() => decrypt(enc.slice(0, -4) + "AAAA"));
  const st = signState("u1", "strava", 1000);
  assert.deepEqual(verifyState(st, 2000), { userId: "u1", provider: "strava" });
  assert.equal(verifyState(st, 1000 + 11 * 60 * 1000), null);
  assert.equal(verifyState(st.slice(0, -2) + "xx", 2000), null);
});

test("provider list shows configuration honestly", async () => {
  const body = (await (await ctx.call("/v1/integrations")).json()) as { data: any[] };
  const byId = Object.fromEntries(body.data.map((p) => [p.id, p]));
  assert.equal(byId.strava.configured, true);
  assert.equal(byId.google.configured, false);
  assert.equal(byId.apple_health.mode, "on_device");
  assert.match(byId.google.note, /Never reads Gmail/);
});

test("Strava: authorize -> callback stores ENCRYPTED tokens -> sync is idempotent -> daily totals", async () => {
  const auth = (await (await ctx.call("/v1/integrations/strava/authorize", { method: "POST" })).json()) as { url: string };
  const u = new URL(auth.url);
  assert.equal(u.hostname, "www.strava.com");
  assert.equal(u.searchParams.get("scope"), "activity:read");
  const state = u.searchParams.get("state")!;

  const cb = await fetch(`${ctx.baseUrl}/v1/integrations/strava/callback?code=abc&state=${encodeURIComponent(state)}`);
  assert.equal(cb.status, 200);
  const row = ctx.db.prepare("SELECT * FROM integration_accounts WHERE provider='strava'").get() as any;
  assert.ok(row.access_token_enc && !row.access_token_enc.includes("AT1"), "token must not be stored in clear");

  const s1 = (await (await ctx.call("/v1/integrations/strava/sync", { method: "POST" })).json()) as { imported: number };
  assert.equal(s1.imported, 2); // zero-length activity skipped
  await ctx.call("/v1/integrations/strava/sync", { method: "POST" });
  const n = (ctx.db.prepare("SELECT COUNT(*) AS n FROM metric_samples").get() as { n: number }).n;
  assert.equal(n, 2, "re-sync must not duplicate");

  const daily = (await (await ctx.call("/v1/metrics/daily?since=2026-06-01&until=2026-06-01")).json()) as { data: any[] };
  assert.deepEqual(daily.data, [{ date: "2026-06-01", metric: "active_minutes", value: 45, unit: "min", sources: ["strava"] }]);
});

test("callback rejects a forged or wrong-provider state", async () => {
  const bad = await fetch(`${ctx.baseUrl}/v1/integrations/strava/callback?code=abc&state=garbage.sig`);
  assert.equal(bad.status, 400);
  const { signState } = await import("../src/integrations/crypto.ts");
  const wrong = await fetch(`${ctx.baseUrl}/v1/integrations/strava/callback?code=abc&state=${encodeURIComponent(signState("local", "google"))}`);
  assert.equal(wrong.status, 400);
});

test("unconfigured providers cannot start a flow", async () => {
  const res = await ctx.call("/v1/integrations/google/authorize", { method: "POST" });
  assert.equal(res.status, 400);
});

test("on-device ingest: validates, is idempotent per day, and averages vital signs", async () => {
  const post = (samples: unknown[]) => ctx.call("/v1/ingest/samples", { method: "POST", body: JSON.stringify({ samples }) });
  const good = [
    { source: "apple_health", metric: "steps", date: "2026-06-03", value: 8000 },
    { source: "health_connect", metric: "sleep_minutes", date: "2026-06-03", value: 430 },
    { source: "apple_health", metric: "resting_heart_rate", date: "2026-06-03", value: 60, external_id: "a" },
    { source: "apple_health", metric: "resting_heart_rate", date: "2026-06-03", value: 64, external_id: "b" },
  ];
  assert.equal((await post(good)).status, 201);
  assert.equal((await post(good)).status, 201);
  const daily = (await (await ctx.call("/v1/metrics/daily?since=2026-06-03&until=2026-06-03")).json()) as { data: any[] };
  const by = Object.fromEntries(daily.data.map((d) => [d.metric, d.value]));
  assert.equal(by.steps, 8000);
  assert.equal(by.sleep_minutes, 430);
  assert.equal(by.resting_heart_rate, 62);

  assert.equal((await post([{ source: "strava", metric: "steps", date: "2026-06-03", value: 1 }])).status, 400, "server sources can't be spoofed via ingest");
  assert.equal((await post([{ source: "apple_health", metric: "bogus", date: "2026-06-03", value: 1 }])).status, 400);
  assert.equal((await post([{ source: "apple_health", metric: "steps", date: "06/03/2026", value: 1 }])).status, 400);
});

test("disconnect removes the account, deauthorizes upstream, and can purge imported data", async () => {
  const res = await ctx.call("/v1/integrations/strava?purge=true", { method: "DELETE" });
  assert.equal(res.status, 204);
  assert.ok(outbound.some((u) => u.includes("/oauth/deauthorize")));
  const acct = ctx.db.prepare("SELECT COUNT(*) AS n FROM integration_accounts WHERE provider='strava'").get() as { n: number };
  assert.equal(acct.n, 0);
  const samples = ctx.db.prepare("SELECT COUNT(*) AS n FROM metric_samples WHERE source='strava'").get() as { n: number };
  assert.equal(samples.n, 0);
});
