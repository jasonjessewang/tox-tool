/**
 * API-key auth: the extension point for "other apps" integration (a workout-app sync
 * job, an AirNow poller, a future partner integration) without ever sharing a user's
 * actual login. Keys are scoped ("read" / "write") and revocable; only a SHA-256 hash is
 * stored, never the raw key, so a database leak doesn't leak usable credentials --
 * standard practice for API keys, same principle as password hashing.
 */
import { createHash, randomBytes } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { db } from "./db.ts";

export function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function generateApiKey(label: string, scopes: "read" | "read,write" = "read,write") {
  const rawKey = `eak_${randomBytes(24).toString("base64url")}`;
  const stmt = db.prepare(
    "INSERT INTO api_keys (key_hash, label, scopes) VALUES (?, ?, ?)"
  );
  stmt.run(hashKey(rawKey), label, scopes);
  // The raw key is only ever returned here, at creation time -- it cannot be recovered
  // later, same as how most real API providers (Stripe, GitHub, etc.) do it.
  return rawKey;
}

export interface AuthedRequest extends Request {
  apiKey?: { id: number; label: string; scopes: string[] };
}

export function requireApiKey(requiredScope: "read" | "write") {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.header("authorization") ?? "";
    const match = header.match(/^Bearer (.+)$/);
    if (!match) {
      res.status(401).json({ error: "Missing Authorization: Bearer <key> header" });
      return;
    }
    const hash = hashKey(match[1]);
    const row = db
      .prepare("SELECT id, label, scopes FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL")
      .get(hash) as { id: number; label: string; scopes: string } | undefined;
    if (!row) {
      res.status(401).json({ error: "Invalid or revoked API key" });
      return;
    }
    const scopes = row.scopes.split(",");
    if (!scopes.includes(requiredScope)) {
      res.status(403).json({ error: `API key lacks the '${requiredScope}' scope` });
      return;
    }
    req.apiKey = { id: row.id, label: row.label, scopes };
    next();
  };
}

export function userIdOf(req: Request): string {
  // Single-tenant today ('local', matching the mobile app's own default), but every
  // query already filters by user_id -- flipping this to a real per-caller id later
  // (e.g. from the API key or a JWT) doesn't touch any query, only this one function.
  return (req.header("x-user-id") as string) || "local";
}
