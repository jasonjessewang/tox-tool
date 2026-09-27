// Mirrors tox-exposure-tool/tests/test_scoring.py scenario-for-scenario, so the two
// engines can be checked against the same expected behavior, not just "compiles."
import { scoreLogs, loadHazardDb, loadConcepts } from "./scoring";
import type { LogStore } from "./types";

const EMPTY_LOGS: LogStore = { food: [], products: [], environment: [], air_quality: [], practices: [] };

function logs(overrides: Partial<LogStore>): LogStore {
  return { ...EMPTY_LOGS, ...overrides };
}

const now = new Date().toISOString();
function food(food_item: string, extra: Partial<LogStore["food"][0]> = {}) {
  return {
    id: "1",
    log_date: "2026-01-01",
    meal: "breakfast" as const,
    food_item,
    processing_level: null,
    notes: "",
    created_at: now,
    ...extra,
  };
}
function product(name: string, ingredients: string) {
  return {
    id: "1",
    log_date: "2026-01-01",
    product_type: "Shampoo",
    product_name: name,
    ingredients_text: ingredients,
    notes: "",
    created_at: now,
  };
}
function environment(condition_type: string, detail: string) {
  return {
    id: "1",
    log_date: "2026-01-01",
    location: "Home",
    condition_type,
    detail,
    notes: "",
    created_at: now,
  };
}

test("hazard db loads with 36 unique substances", () => {
  const substances = loadHazardDb();
  expect(substances.length).toBe(36);
  const ids = new Set(substances.map((s) => s.id));
  expect(ids.size).toBe(substances.length);
});

test("hazard db substances carry live-synced references", () => {
  const substances = loadHazardDb();
  const withRefs = substances.filter((s) => s.references && s.references.length > 0);
  expect(withRefs.length).toBeGreaterThanOrEqual(30);
  const ref = withRefs[0].references![0];
  expect(ref.url.startsWith("https://pubmed.ncbi.nlm.nih.gov/")).toBe(true);
});

test("every substance carries concept_tags resolvable in the concepts glossary", () => {
  const substances = loadHazardDb();
  const concepts = loadConcepts();
  for (const s of substances) {
    expect(s.technical_note).toBeTruthy();
    expect(s.concept_tags.length).toBeGreaterThan(0);
    for (const tag of s.concept_tags) {
      expect(concepts[tag]).toBeDefined();
    }
  }
});

test("food dye and added sugar both flagged from free text", () => {
  const report = scoreLogs(logs({ food: [food("cereal with red 40 and added sugar")] }));
  const flaggedIds = report.category_summary.food!.substances.map((s) => s.id);
  expect(flaggedIds).toContain("artificial_food_dyes");
  expect(flaggedIds).toContain("added_sugar");
  expect(report.overall_score).toBeGreaterThan(0);
});

test("acrylamide needs the exact 'browned toast' phrase, not just 'dark toasted'", () => {
  const notMatched = scoreLogs(logs({ food: [food("dark toasted bagel")] }));
  expect(notMatched.category_summary.food?.substances.map((s) => s.id) ?? []).not.toContain("acrylamide");

  const matched = scoreLogs(logs({ food: [food("browned toast bagel")] }));
  expect(matched.category_summary.food!.substances.map((s) => s.id)).toContain("acrylamide");
});

test("real ingredient list flags SLS, phthalates (via fragrance), formaldehyde-releasers", () => {
  const report = scoreLogs(
    logs({ products: [product("Brand X Shampoo", "Water, Sodium Laureth Sulfate, Fragrance, DMDM Hydantoin")] })
  );
  const flaggedIds = report.category_summary.personal_care!.substances.map((s) => s.id);
  expect(flaggedIds).toEqual(
    expect.arrayContaining(["sodium_lauryl_sulfate", "phthalates", "formaldehyde_releasers"])
  );
});

test("mold flagged at concern level 3, contributing exactly 3 to environment score", () => {
  const report = scoreLogs(logs({ environment: [environment("Mold / musty smell", "musty smell under sink")] }));
  expect(report.category_summary.environment!.score).toBe(3);
  expect(report.recommendations.some((r) => r.source === "Indoor mold / mycotoxin exposure")).toBe(true);
});

test("empty logs yield a zero score and the minimal band", () => {
  const report = scoreLogs(EMPTY_LOGS);
  expect(report.overall_score).toBe(0);
  expect(report.awareness_band.key).toBe("minimal");
  expect(report.focus_items).toHaveLength(0);
});

test("ultra-processed food is structural, not a substance match", () => {
  const report = scoreLogs(
    logs({
      food: [
        food("toaster pastry", { processing_level: 4 }),
        food("packaged snack cake", { processing_level: 4 }),
      ],
    })
  );
  expect(report.processing_counts[4]).toBe(2);
  expect(report.category_summary.food!.score).toBeGreaterThanOrEqual(2);
  expect(report.recommendations.some((r) => r.tip_key === "processing:reduce_upf")).toBe(true);
});

test("air quality: Unhealthy for Sensitive Groups reading flows into environment score + focus", () => {
  const report = scoreLogs(
    logs({ air_quality: [{ id: "1", log_date: "2026-01-01", location: "Home", pollutant: "PM2.5", value: 40, source: "AirNow", notes: "", created_at: now }] })
  );
  expect(report.air_quality_readings).toHaveLength(1);
  expect(report.air_quality_readings[0].category).toBe("Unhealthy for Sensitive Groups");
  expect(report.category_summary.environment!.score).toBeGreaterThan(0);
  expect(report.recommendations.some((r) => r.tip_key.startsWith("air_quality:"))).toBe(true);
});

test("air quality: a Good reading does not inflate the score", () => {
  const report = scoreLogs(
    logs({ air_quality: [{ id: "1", log_date: "2026-01-01", location: "Home", pollutant: "PM2.5", value: 4, source: "AirNow", notes: "", created_at: now }] })
  );
  expect(report.air_quality_readings[0].category).toBe("Good");
  expect(report.overall_score).toBe(0);
});

test("resilience practices are tracked but never change the exposure score", () => {
  const base = logs({ food: [food("cereal with red 40")] });
  const withPractice = { ...base, practices: [{ id: "1", log_date: "2026-01-01", practice_type: "fasting" as const, duration_minutes: 720, detail: "", notes: "", created_at: now }] };
  const r1 = scoreLogs(base);
  const r2 = scoreLogs(withPractice);
  expect(r2.overall_score).toBe(r1.overall_score);
  expect(r2.practice_summary.fasting?.total_minutes).toBe(720);
});

test("produce diversity tip is informational only, never affects the score", () => {
  const report = scoreLogs(
    logs({ food: [food("strawberries"), food("strawberries"), food("spinach")] })
  );
  expect(report.produce_summary.watch_total).toBe(3);
  expect(report.produce_summary.tip).toBeTruthy();
  expect(report.overall_score).toBe(0);
});

test("Quick Wins favors low-effort SLS over high-effort, high-concern mold", () => {
  const report = scoreLogs(
    logs({
      products: [product("Shampoo", "Water, Sodium Laureth Sulfate")],
      environment: [environment("Mold / musty smell", "musty smell")],
    })
  );
  expect(report.focus_items.every((f) => f.source === "Indoor mold / mycotoxin exposure")).toBe(true);
  expect(report.quick_wins.every((q) => q.action_effort === "low")).toBe(true);
  expect(report.quick_wins.some((q) => q.source.includes("Sodium Lauryl Sulfate"))).toBe(true);
  expect(report.quick_wins.some((q) => q.source.toLowerCase().includes("mold"))).toBe(false);
});

test("a completed tip is deprioritized in ranking but stays visible in all recommendations", () => {
  const scenario = logs({ environment: [environment("Mold / musty smell", "musty smell")] });
  const fresh = scoreLogs(scenario);
  const moldKey = fresh.recommendations.find((r) => r.source === "Indoor mold / mycotoxin exposure")!.tip_key;

  const completed = scoreLogs(scenario, loadHazardDb(), new Set([moldKey]));
  const match = completed.recommendations.find((r) => r.tip_key === moldKey)!;
  expect(match.completed).toBe(true);
  expect(completed.recommendations.map((r) => r.tip_key)).toContain(moldKey);
});
