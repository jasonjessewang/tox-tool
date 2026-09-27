/**
 * Full-stack tests against a real Express app + a temp SQLite file (node:sqlite) --
 * no mocking. Uses Node's built-in test runner, so no extra dependency.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { unlinkSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, "test.db");
for (const suffix of ["", "-wal", "-shm"]) {
  if (existsSync(TEST_DB + suffix)) unlinkSync(TEST_DB + suffix);
}
process.env.DB_PATH = TEST_DB;

const { db } = await import("../src/db.ts");
const { buildApiRouter } = await import("../src/routes.ts");
const { generateApiKey } = await import("../src/auth.ts");
const express = (await import("express")).default;

const app = express();
app.use(express.json());
app.use("/v1", buildApiRouter());

let server: import("node:http").Server;
let baseUrl: string;
let apiKey: string;

before(async () => {
  apiKey = generateApiKey("test-suite", "read,write");
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  db.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    if (existsSync(TEST_DB + suffix)) unlinkSync(TEST_DB + suffix);
  }
});

function authed(path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${apiKey}` },
  });
}

test("rejects requests with no API key", async () => {
  const res = await fetch(`${baseUrl}/v1/food-logs`);
  assert.equal(res.status, 401);
});

test("rejects requests with a bogus API key", async () => {
  const res = await fetch(`${baseUrl}/v1/food-logs`, { headers: { Authorization: "Bearer eak_not_a_real_key" } });
  assert.equal(res.status, 401);
});

test("inserts and retrieves a food log", async () => {
  const insertRes = await authed("/v1/food-logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ log_date: "2026-01-01", meal: "breakfast", food_item: "oats" }),
  });
  assert.equal(insertRes.status, 201);
  const inserted = await insertRes.json();
  assert.equal(inserted.data.food_item, "oats");

  const listRes = await authed("/v1/food-logs");
  const listed = await listRes.json();
  assert.ok(listed.data.some((r: any) => r.id === inserted.data.id));
});

test("400s when log_date is missing", async () => {
  const res = await authed("/v1/food-logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meal: "breakfast", food_item: "oats" }),
  });
  assert.equal(res.status, 400);
});

test("results are sorted by log_date desc, then insertion order desc", async () => {
  for (const [date, item] of [
    ["2026-02-01", "day2-a"],
    ["2026-01-01", "day1"],
    ["2026-02-01", "day2-b"],
  ] as const) {
    await authed("/v1/environment-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log_date: date, location: "Home", condition_type: item }),
    });
  }
  const res = await authed("/v1/environment-logs");
  const { data } = await res.json();
  const items = data.map((r: any) => r.condition_type);
  assert.deepEqual(items, ["day2-b", "day2-a", "day1"]);
});

test("cursor pagination returns disjoint pages that together cover all rows", async () => {
  for (let i = 0; i < 25; i++) {
    await authed("/v1/practice-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log_date: "2026-03-01", practice_type: "exercise", detail: `run-${i}` }),
    });
  }
  const page1Res = await authed("/v1/practice-logs?limit=10");
  const page1 = await page1Res.json();
  assert.equal(page1.data.length, 10);
  assert.ok(page1.next_cursor);

  const page2Res = await authed(`/v1/practice-logs?limit=10&cursor=${page1.next_cursor}`);
  const page2 = await page2Res.json();
  assert.equal(page2.data.length, 10);

  const page3Res = await authed(`/v1/practice-logs?limit=10&cursor=${page2.next_cursor}`);
  const page3 = await page3Res.json();
  assert.equal(page3.data.length, 5);
  assert.equal(page3.next_cursor, null);

  const allIds = [...page1.data, ...page2.data, ...page3.data].map((r: any) => r.id);
  assert.equal(new Set(allIds).size, 25, "pages must not overlap or skip rows");
});

test("since/until date filtering works", async () => {
  const res = await authed("/v1/environment-logs?since=2026-02-01&until=2026-02-28");
  const { data } = await res.json();
  assert.ok(data.every((r: any) => r.log_date >= "2026-02-01" && r.log_date <= "2026-02-28"));
  assert.ok(data.length >= 2);
});

test("delete removes a row and is idempotent (404 on second delete)", async () => {
  const insertRes = await authed("/v1/biomarker-logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ log_date: "2026-01-01", metric: "HRV", value: 55 }),
  });
  const { data: inserted } = await insertRes.json();

  const del1 = await authed(`/v1/biomarker-logs/${inserted.id}`, { method: "DELETE" });
  assert.equal(del1.status, 204);

  const del2 = await authed(`/v1/biomarker-logs/${inserted.id}`, { method: "DELETE" });
  assert.equal(del2.status, 404);
});

test("a read-only API key can read but not write", async () => {
  const readOnlyKey = generateApiKey("readonly-client", "read");
  const readRes = await fetch(`${baseUrl}/v1/food-logs`, { headers: { Authorization: `Bearer ${readOnlyKey}` } });
  assert.equal(readRes.status, 200);

  const writeRes = await fetch(`${baseUrl}/v1/food-logs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${readOnlyKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ log_date: "2026-01-01", meal: "breakfast", food_item: "test" }),
  });
  assert.equal(writeRes.status, 403);
});

test("users are isolated: user A cannot see user B's logs", async () => {
  await fetch(`${baseUrl}/v1/food-logs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "X-User-Id": "alice", "Content-Type": "application/json" },
    body: JSON.stringify({ log_date: "2026-01-01", meal: "lunch", food_item: "alice-only-item" }),
  });
  const bobRes = await fetch(`${baseUrl}/v1/food-logs`, {
    headers: { Authorization: `Bearer ${apiKey}`, "X-User-Id": "bob" },
  });
  const bobData = await bobRes.json();
  assert.ok(!bobData.data.some((r: any) => r.food_item === "alice-only-item"));
});

test("indexed list queries stay fast (p95 latency check) with 500 rows", async () => {
  const inserts = [];
  for (let i = 0; i < 500; i++) {
    inserts.push(
      authed("/v1/practice-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log_date: "2026-04-01", practice_type: "exercise", detail: `bulk-${i}` }),
      })
    );
  }
  await Promise.all(inserts);

  const timings: number[] = [];
  for (let i = 0; i < 20; i++) {
    const start = performance.now();
    await authed("/v1/practice-logs?limit=50");
    timings.push(performance.now() - start);
  }
  timings.sort((a, b) => a - b);
  const p95 = timings[Math.floor(timings.length * 0.95)];
  // Generous ceiling for a local loopback request against an indexed query -- this is
  // a regression guard (catches "someone removed the index"), not a hard SLA.
  assert.ok(p95 < 50, `p95 latency was ${p95.toFixed(2)}ms, expected < 50ms`);
});
