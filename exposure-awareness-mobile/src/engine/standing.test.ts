/**
 * The standing-exposure model. What was logged this week (scoreLogs' scores) and what the shelf
 * carries week after week (the ledger) are separate measurements: a scan catalogs a product, it is
 * not a meal eaten, so it must not be counted a second time in the week's score -- and the advice
 * must not go quiet just because nothing flagged was typed in this week.
 */
import { scoreLogs, loadHazardDb } from "./scoring";
import { buildLedger, standingFromLedger } from "./ingredients/ledger";
import { SCAN_NOTE_PREFIX, isScanEntry } from "./scanNotes";
import type { ShelfItem } from "./ingredients/types";
import type { LogStore, StandingExposure } from "./types";

const EMPTY: LogStore = { food: [], products: [], environment: [], air_quality: [], practices: [] };
const created_at = "2026-01-01T00:00:00.000Z";

const meal = (food_item: string, notes = "", processing_level: 1 | 2 | 3 | 4 | null = null) => ({ id: "f", log_date: "2026-01-01", meal: "lunch" as const, food_item, processing_level, notes, created_at });
const care = (product_name: string, ingredients_text: string, notes = "") => ({ id: "p", log_date: "2026-01-01", product_type: "care", product_name, ingredients_text, notes, created_at });
const ids = (r: ReturnType<typeof scoreLogs>) => Object.values(r.category_summary).flatMap((c) => c?.substances.map((s) => s.id) ?? []);

const scanNote = (contains: string) => `${SCAN_NOTE_PREFIX}label. Contains: ${contains}.`;

describe("a scan entry catalogs a product; it is not a meal eaten", () => {
  test("isScanEntry recognises the note the scan flow writes", () => {
    expect(isScanEntry({ notes: scanNote("Parabens") })).toBe(true);
    expect(isScanEntry({ notes: "Contains: Parabens." })).toBe(false);
    expect(isScanEntry({ notes: "" })).toBe(false);
    expect(isScanEntry({})).toBe(false);
  });

  test("a scanned product adds nothing to the week's flagged pattern", () => {
    const withScan = scoreLogs({ ...EMPTY, products: [care("Shampoo", "Parabens, Phthalates", scanNote("Parabens, Phthalates"))] });
    expect(withScan.overall_score).toBe(0);
    expect(ids(withScan)).toEqual([]);
    expect(withScan.entries_analyzed.products).toBe(0);
  });

  test("a scanned food's processing level does not count toward the ultra-processed tally", () => {
    const withScan = scoreLogs({ ...EMPTY, food: Array.from({ length: 4 }, () => meal("Instant ramen", scanNote("Added/refined sugar"), 4)) });
    expect(withScan.processing_counts[4]).toBeUndefined();
    expect(withScan.overall_score).toBe(0);
    expect(withScan.entries_analyzed.food).toBe(0);
  });

  test("the same product, actually used and logged by hand, still counts", () => {
    const used = scoreLogs({ ...EMPTY, products: [care("Shampoo", "Water, Methylparaben, Fragrance", "used it this morning")] });
    expect(ids(used)).toEqual(expect.arrayContaining(["parabens", "phthalates"]));
    expect(used.entries_analyzed.products).toBe(1);
  });

  test("scans mixed with hand-logged entries: only the hand-logged ones are scored", () => {
    const report = scoreLogs({
      ...EMPTY,
      food: [meal("Sports drink with red 40"), meal("Instant ramen", scanNote("BHA / BHT"), 4)],
    });
    expect(ids(report)).toContain("artificial_food_dyes");
    expect(ids(report)).not.toContain("bha_bht");
    expect(report.entries_analyzed.food).toBe(1);
  });
});

describe("standing exposure feeds the advice, not the scores", () => {
  const standing = (over: Partial<StandingExposure> & Pick<StandingExposure, "substanceId">): StandingExposure => ({ weight: 3, via: ["Daily shampoo"], ...over });

  test("with nothing logged, shelf substances still produce Focus and Quick Wins", () => {
    const report = scoreLogs(EMPTY, undefined, new Set(), { standing: [standing({ substanceId: "parabens" }), standing({ substanceId: "phthalates", via: ["Body wash"] })] });
    expect(report.focus_items.length).toBeGreaterThan(0);
    expect(report.focus_items.every((r) => r.origin === "shelf")).toBe(true);
    expect(report.focus_items.some((r) => r.via?.includes("Body wash"))).toBe(true);
    expect(report.quick_wins.length).toBeGreaterThan(0);
  });

  test("standing exposure never changes the week's scores or band", () => {
    const logs = { ...EMPTY, food: [meal("cereal with red 40")] };
    const without = scoreLogs(logs);
    const withStanding = scoreLogs(logs, undefined, new Set(), { standing: [standing({ substanceId: "parabens", weight: 20 }), standing({ substanceId: "mold_indoor", weight: 20 })] });
    expect(withStanding.overall_score).toBe(without.overall_score);
    expect(withStanding.awareness_band).toEqual(without.awareness_band);
    expect(withStanding.category_summary).toEqual(without.category_summary);
    expect(withStanding.entries_analyzed).toEqual(without.entries_analyzed);
  });

  test("a daily-use product outranks a rare one for the same substance weight scale", () => {
    const report = scoreLogs(EMPTY, undefined, new Set(), { standing: [standing({ substanceId: "triclosan", weight: 0.5, via: ["Rare mouthwash"] }), standing({ substanceId: "parabens", weight: 7, via: ["Daily lotion"] })] });
    expect(report.focus_items[0].tip_key.startsWith("parabens:")).toBe(true);
  });

  test("a substance the logs also flagged keeps its log-derived tips and learns where it lives on the shelf", () => {
    const report = scoreLogs({ ...EMPTY, food: [meal("cereal with red 40")] }, undefined, new Set(), { standing: [standing({ substanceId: "artificial_food_dyes", via: ["Fruit cereal"] })] });
    const dye = report.recommendations.filter((r) => r.tip_key.startsWith("artificial_food_dyes:"));
    expect(dye.length).toBeGreaterThan(0);
    expect(dye.every((r) => r.origin === "logs" && r.via?.[0] === "Fruit cereal")).toBe(true);
  });

  test("a completed shelf tip yields to open ones, like any other tip", () => {
    const first = scoreLogs(EMPTY, undefined, new Set(), { standing: [standing({ substanceId: "parabens", weight: 7 }), standing({ substanceId: "triclosan", weight: 1 })] });
    const doneKey = first.focus_items[0].tip_key;
    const again = scoreLogs(EMPTY, undefined, new Set([doneKey]), { standing: [standing({ substanceId: "parabens", weight: 7 }), standing({ substanceId: "triclosan", weight: 1 })] });
    expect(again.focus_items[0].completed).toBe(false);
    expect(again.focus_items.map((r) => r.tip_key)).not.toContain(doneKey); // open tips fill Focus first
    expect(again.recommendations.find((r) => r.tip_key === doneKey)?.completed).toBe(true); // but it stays visible in the full list
  });

  test("an unknown substance id is ignored rather than throwing", () => {
    expect(() => scoreLogs(EMPTY, undefined, new Set(), { standing: [standing({ substanceId: "not_a_real_substance" })] })).not.toThrow();
  });

  test("no standing exposure, no logs: nothing to advise (as before)", () => {
    const report = scoreLogs(EMPTY);
    expect(report.focus_items).toEqual([]);
    expect(report.quick_wins).toEqual([]);
  });
});

describe("Focus and Quick Wins show a shelf substance once, and respect what the person decided to keep", () => {
  const standing = (substanceId: string, weight = 3, via = ["Daily shampoo"]): StandingExposure => ({ substanceId, weight, via });
  const sourcesOf = (items: { tip_key: string }[]) => items.map((i) => i.tip_key.split(":")[0]);

  test("a shelf substance appears once in Focus, however many tips it has", () => {
    const report = scoreLogs(EMPTY, undefined, new Set(), { standing: [standing("parabens", 9), standing("phthalates", 8), standing("triclosan", 7)] });
    expect(report.focus_items).toHaveLength(3);
    expect(new Set(sourcesOf(report.focus_items)).size).toBe(3);
  });

  test("with a single shelf substance, Focus is one decision rather than several tips about it", () => {
    const report = scoreLogs(EMPTY, undefined, new Set(), { standing: [standing("parabens", 9)] });
    expect(report.focus_items).toHaveLength(1);
    expect(report.recommendations.filter((r) => r.tip_key.startsWith("parabens:")).length).toBeGreaterThan(1); // the other tips are still in the full list
  });

  test("marking a shelf tip done moves Focus on to that substance's next open tip", () => {
    const one = { standing: [standing("parabens", 9)] };
    const first = scoreLogs(EMPTY, undefined, new Set(), one).focus_items[0].tip_key;
    const next = scoreLogs(EMPTY, undefined, new Set([first]), one).focus_items[0];
    expect(next.tip_key).not.toBe(first);
    expect(next.completed).toBe(false);
  });

  test("tips that come from this week's logs are not thinned: one logged substance can still fill Focus", () => {
    const env = { id: "e", log_date: "2026-01-01", location: "Home", condition_type: "Mold", detail: "mold behind the sink", notes: "", created_at };
    const report = scoreLogs({ ...EMPTY, environment: [env] });
    expect(report.focus_items).toHaveLength(3);
    expect(new Set(sourcesOf(report.focus_items))).toEqual(new Set(["mold_indoor"]));
  });

  test("a kept source stays out of Focus and Quick Wins but remains in the full list", () => {
    const advice = { standing: [standing("triclosan", 9), standing("parabens", 5)], kept: new Set(["triclosan"]) };
    const report = scoreLogs(EMPTY, undefined, new Set(), advice);
    expect(sourcesOf(report.focus_items)).not.toContain("triclosan");
    expect(sourcesOf(report.quick_wins)).not.toContain("triclosan");
    expect(sourcesOf(report.focus_items)).toContain("parabens");
    expect(sourcesOf(report.recommendations)).toContain("triclosan");
  });

  test("keeping something the logs flagged works the same way", () => {
    const logs = { ...EMPTY, food: [meal("cereal with red 40"), meal("soda with red 40")] };
    expect(sourcesOf(scoreLogs(logs).focus_items)).toContain("artificial_food_dyes");
    expect(sourcesOf(scoreLogs(logs, undefined, new Set(), { kept: new Set(["artificial_food_dyes"]) }).focus_items)).not.toContain("artificial_food_dyes");
  });

  test("keeping works for the non-substance sources too", () => {
    const logs = { ...EMPTY, food: Array.from({ length: 3 }, () => meal("Instant ramen", "", 4)) };
    expect(sourcesOf(scoreLogs(logs).focus_items)).toContain("processing");
    expect(sourcesOf(scoreLogs(logs, undefined, new Set(), { kept: new Set(["processing"]) }).focus_items)).not.toContain("processing");
  });

  test("keeping never changes the scores", () => {
    const logs = { ...EMPTY, food: [meal("cereal with red 40")] };
    const plain = scoreLogs(logs);
    const kept = scoreLogs(logs, undefined, new Set(), { kept: new Set(["artificial_food_dyes"]) });
    expect(kept.overall_score).toBe(plain.overall_score);
    expect(kept.category_summary).toEqual(plain.category_summary);
  });
});

describe("standingFromLedger", () => {
  const item = (id: string, name: string, ingredientsText: string, frequency: ShelfItem["frequency"]): ShelfItem => ({
    id, addedAt: "2026-01-01T00:00:00.000Z", removedAt: null, name, brand: "", kind: "personal_care", barcode: null, source: "text",
    ingredientsText, nova: null, nutrition: null, frequency, servingsPerUse: 1,
  });
  const now = new Date("2026-03-01T12:00:00Z");

  test("carries each shelf substance with its weekly weight and the products behind it", () => {
    const ledger = buildLedger([item("a", "Daily lotion", "Water, Methylparaben, Glycerin", "daily"), item("b", "Sunday mask", "Water, Propylparaben", "weekly")], now);
    const st = standingFromLedger(ledger);
    const parabens = st.find((s) => s.substanceId === "parabens");
    expect(parabens).toBeDefined();
    expect(parabens!.via).toEqual(expect.arrayContaining(["Daily lotion", "Sunday mask"]));
    expect(parabens!.weight).toBeGreaterThan(0);
  });

  test("a retired product stops contributing", () => {
    const retired = { ...item("a", "Old lotion", "Water, Methylparaben", "daily"), removedAt: "2026-02-01T00:00:00.000Z" };
    expect(standingFromLedger(buildLedger([retired], now))).toEqual([]);
  });

  test("only substances the database knows can be advised on", () => {
    const known = new Set(loadHazardDb().map((s) => s.id));
    const st = standingFromLedger(buildLedger([item("a", "Lotion", "Water, Methylparaben, Triclosan, Fragrance", "daily")], now));
    expect(st.length).toBeGreaterThan(0);
    for (const s of st) expect(known.has(s.substanceId)).toBe(true);
  });
});
