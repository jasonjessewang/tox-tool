/**
 * Provider tokens are encrypted at rest (AES-256-GCM) and OAuth `state` is HMAC-signed.
 * Key comes from INTEGRATION_KEY (32 bytes, hex or base64). Never a default -- a missing
 * key fails loudly rather than silently storing tokens in the clear.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function key(): Buffer {
  const raw = process.env.INTEGRATION_KEY;
  if (!raw) throw new Error("INTEGRATION_KEY is not set (32 bytes, hex or base64)");
  const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("INTEGRATION_KEY must decode to 32 bytes");
  return buf;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

const STATE_TTL_MS = 10 * 60 * 1000;

export function signState(userId: string, provider: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ u: userId, p: provider, t: now })).toString("base64url");
  const sig = createHmac("sha256", key()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string, now = Date.now()): { userId: string; provider: string } | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", key()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { u, p, t } = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (now - t > STATE_TTL_MS) return null;
    return { userId: u, provider: p };
  } catch {
    return null;
  }
}
