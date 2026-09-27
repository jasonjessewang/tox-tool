/**
 * tallyDay is the per-day bookkeeping the wellness score reads; scoreLogs is what the awareness band reads. They must
 * never drift apart: the same logs have to add up to the same flagged points either way.
 */
import { scoreLogs, tallyDay } from "../scoring";
import { Rng } from "../../sim/rng";
import type { LogStore } from "../types";

const created_at = "2026-01-01T00:00:00.000Z";
const FOODS = ["rice and beans", "cereal with added sugar", "hot dogs and bacon", "sports drink with red 40 and yellow 5", "canned chili from a BPA-lined can", "granola bar with bht", "avocado toast", "sugar-free gum", "salad", "takeout in a grease-resistant wrapper", "bottled water"];
const PRODUCTS = ["water, sodium laureth sulfate, fragrance", "glycerin, methylparaben, phenoxyethanol", "oats", "aluminum chlorohydrate, talc", "triclosan toothpaste"];
const ENV = ["mold behind the sink", "gas stove on all evening", "candle and incense burning", "new carpet smell", "dry air in the office"];

function randomLogs(r: Rng): LogStore {
  const n = (max: number) => r.int(0, max);
  return {
    food: Array.from({ length: n(6) }, (_, i) => ({ id: `f${i}`, log_date: "2026-09-25", meal: "lunch" as const, food_item: r.pick(FOODS), processing_level: r.pick([null, 1, 2, 3, 4] as const), notes: r.chance(0.2) ? "Scanned label. Contains: Added/refined sugar." : "", created_at })),
    products: Array.from({ length: n(3) }, (_, i) => ({ id: `p${i}`, log_date: "2026-09-25", product_type: "care", product_name: "Product", ingredients_text: r.pick(PRODUCTS), notes: r.chance(0.2) ? "Scanned label." : "", created_at })),
    environment: Array.from({ length: n(2) }, (_, i) => ({ id: `e${i}`, log_date: "2026-09-25", location: "Home", condition_type: "Home", detail: r.pick(ENV), notes: "", created_at })),
    air_quality: Array.from({ length: n(2) }, (_, i) => ({ id: `a${i}`, log_date: "2026-09-25", location: "Home", pollutant: "PM2.5" as const, value: r.pick([4, 12, 25, 45, 80, 160]), source: "manual", notes: "", created_at })),
    practices: [],
  };
}

test("for any single day, tallyDay adds up to the same flagged points as scoreLogs", () => {
  const r = new Rng(20260925);
  for (let i = 0; i < 300; i++) {
    const logs = randomLogs(r);
    // scoreLogs caps ultra-processed points at 6 per window; a single day here has at most 6 food entries, so the cap never bites
    const report = scoreLogs(logs);
    const tally = tallyDay(logs);
    expect({ i, points: tally.points }).toEqual({ i, points: report.overall_score });
    const analyzed = report.entries_analyzed;
    expect({ i, entries: tally.entries }).toEqual({ i, entries: analyzed.food + analyzed.products + analyzed.environment + analyzed.air_quality });
  }
});

test("the breakdown by source sums to the points", () => {
  const r = new Rng(7);
  for (let i = 0; i < 100; i++) {
    const t = tallyDay(randomLogs(r));
    expect(Object.values(t.by).reduce((a, b) => a + b, 0)).toBe(t.points);
  }
});

test("scan entries are out, and air readings below the moderate band add nothing but still count as entries", () => {
  const scanned = { id: "x", log_date: "2026-09-25", meal: "lunch" as const, food_item: "Granola bar", processing_level: 4 as const, notes: "Scanned label. Contains: Added/refined sugar.", created_at };
  expect(tallyDay({ food: [scanned], products: [], environment: [], air_quality: [], practices: [] })).toEqual({ entries: 0, points: 0, by: {} });
  const good = { id: "a", log_date: "2026-09-25", location: "Home", pollutant: "PM2.5" as const, value: 4, source: "manual", notes: "", created_at };
  expect(tallyDay({ food: [], products: [], environment: [], air_quality: [good], practices: [] })).toEqual({ entries: 1, points: 0, by: {} });
});
