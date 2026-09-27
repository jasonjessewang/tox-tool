import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startApp } from "./harness.ts";

const dir = path.dirname(fileURLToPath(import.meta.url));
let ctx: Awaited<ReturnType<typeof startApp>>;
before(async () => {
  ctx = await startApp("test-ocr");
});
after(async () => {
  const { shutdownOcr } = await import("../src/ocr.ts");
  await shutdownOcr();
  await ctx.stop();
});

test("reads an ingredient list and nutrition facts from a real image", { timeout: 120000 }, async () => {
  const image = readFileSync(path.join(dir, "fixtures", "label.png")).toString("base64");
  const res = await ctx.call("/v1/ocr", { method: "POST", body: JSON.stringify({ image_base64: image }) });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { text: string; confidence: number };
  const t = body.text.toLowerCase();
  for (const word of ["ingredients", "sugar", "flour", "syrup", "preserve", "calories", "sodium", "protein"]) assert.ok(t.includes(word), `missing "${word}" in: ${t}`);
  assert.match(t, /230/);
  assert.match(t, /160\s*mg/);
  assert.ok(body.confidence > 60, `confidence ${body.confidence}`);
});

test("rejects missing, tiny and non-image payloads", async () => {
  assert.equal((await ctx.call("/v1/ocr", { method: "POST", body: JSON.stringify({}) })).status, 400);
  assert.equal((await ctx.call("/v1/ocr", { method: "POST", body: JSON.stringify({ image_base64: "abcd" }) })).status, 400);
  const junk = Buffer.alloc(500, 7).toString("base64");
  assert.equal((await ctx.call("/v1/ocr", { method: "POST", body: JSON.stringify({ image_base64: junk }) })).status, 415);
  // A file that starts like a PNG but is corrupt must not crash the process either.
  const corrupt = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(600, 9)]).toString("base64");
  const r = await ctx.call("/v1/ocr", { method: "POST", body: JSON.stringify({ image_base64: corrupt }) });
  assert.ok([422, 200].includes(r.status));
  assert.equal((await ctx.call("/v1/evidence?limit=1")).status, 200, "server still alive");
});

test("requires a write-scoped API key", async () => {
  const res = await fetch(`${ctx.baseUrl}/v1/ocr`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(res.status, 401);
});
