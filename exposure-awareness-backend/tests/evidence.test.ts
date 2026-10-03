import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { startApp } from "./harness.ts";

/** however many items the seed file holds -- the tests are about seeding and paging, not a fixed count */
const SEEDED = (JSON.parse(readFileSync(new URL("../seed/evidence.json", import.meta.url), "utf8")) as unknown[]).length;

let ctx: Awaited<ReturnType<typeof startApp>>;
before(async () => {
  ctx = await startApp("test-evidence");
  const { seedEvidence } = await import("../src/seed-evidence.ts");
  assert.equal(seedEvidence(), SEEDED);
});
after(async () => ctx.stop());

test("seeding is idempotent", async () => {
  const { seedEvidence } = await import("../src/seed-evidence.ts");
  seedEvidence();
  const n = (ctx.db.prepare("SELECT COUNT(*) AS n FROM evidence").get() as { n: number }).n;
  assert.equal(n, SEEDED);
});

test("list is ranked by citation count and pages by keyset cursor without gaps or repeats", async () => {
  const seen: number[] = [];
  let cursor: string | null = null;
  do {
    const res = await ctx.call(`/v1/evidence?limit=5${cursor ? `&cursor=${cursor}` : ""}`);
    const body = (await res.json()) as { data: { citation_count: number; pmid: string }[]; next_cursor: string | null };
    seen.push(...body.data.map((d) => d.citation_count));
    cursor = body.next_cursor;
  } while (cursor);
  assert.equal(seen.length, SEEDED);
  assert.deepEqual(seen, [...seen].sort((a, b) => b - a));
});

test("filter by substance uses the link table; unknown substance returns nothing", async () => {
  const lead = (await (await ctx.call("/v1/evidence?substance=lead_exposure")).json()) as { data: { pmid: string }[] };
  assert.deepEqual(lead.data.map((d) => d.pmid), ["16002379"]);
  const none = (await (await ctx.call("/v1/evidence?substance=nope")).json()) as { data: unknown[] };
  assert.equal(none.data.length, 0);
});

test("studies of something close by are background, not evidence: they are not found by ?substance=, and say what they are background for", async () => {
  const dyes = (await (await ctx.call("/v1/evidence?substance=artificial_food_dyes")).json()) as { data: { pmid: string }[] };
  assert.deepEqual(dyes.data, []);
  const upf = (await (await ctx.call("/v1/evidence/pmid_38363072")).json()) as { data: { substance_ids: string[]; context_substance_ids: string[] } };
  assert.deepEqual(upf.data.substance_ids, []);
  assert.deepEqual([...upf.data.context_substance_ids].sort(), ["added_sugar", "artificial_food_dyes"]);
});

test("list is a distillable vignette; detail adds the full write-up", async () => {
  const list = (await (await ctx.call("/v1/evidence?topic=sleep")).json()) as { data: any[] };
  assert.equal(list.data.length, 1);
  assert.ok(list.data[0].headline && list.data[0].summary_short);
  assert.equal(list.data[0].summary_detail, undefined);
  const detail = (await (await ctx.call(`/v1/evidence/${list.data[0].id}`)).json()) as { data: any };
  assert.ok(detail.data.summary_detail.length > 200);
  assert.ok(detail.data.limitations.length > 0);
  assert.ok(detail.data.practical.length > 0);
});

test("items awaiting a reviewed summary are never served", async () => {
  ctx.db.prepare("INSERT INTO evidence (id, pmid, title, needs_summary, source) VALUES ('pmid_1','1','Unreviewed',1,'pubmed')").run();
  const body = (await (await ctx.call("/v1/evidence?limit=200")).json()) as { data: { id: string }[] };
  assert.ok(!body.data.some((d) => d.id === "pmid_1"));
});

test("requires an API key", async () => {
  const res = await fetch(`${ctx.baseUrl}/v1/evidence`);
  assert.equal(res.status, 401);
});
