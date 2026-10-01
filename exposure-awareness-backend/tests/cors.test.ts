/**
 * The web build can only reach a self-hosted backend on a different origin if the browser's own preflight check
 * passes; the API key requirement (tested throughout api.test.ts) is the real gate either way.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApp } from "./harness.ts";

let ctx: Awaited<ReturnType<typeof startApp>>;
before(async () => {
  ctx = await startApp("test-cors");
});
after(async () => ctx.stop());

test("a browser preflight (OPTIONS) succeeds with no API key, and allows the caller's origin back", async () => {
  const res = await fetch(`${ctx.baseUrl}/v1/food-logs`, {
    method: "OPTIONS",
    headers: { origin: "https://example.github.io", "access-control-request-method": "POST" },
  });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), "https://example.github.io");
  assert.match(res.headers.get("access-control-allow-methods") ?? "", /POST/);
  assert.match(res.headers.get("access-control-allow-headers") ?? "", /Authorization/i);
});

test("a real cross-origin request still needs the API key -- CORS headers are not a substitute for auth", async () => {
  const res = await fetch(`${ctx.baseUrl}/v1/food-logs`, { headers: { origin: "https://example.github.io" } });
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("access-control-allow-origin"), "https://example.github.io");
});

test("a request with no Origin header (a native app, or curl) is unaffected", async () => {
  const res = await ctx.call("/v1/food-logs");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), null);
});
