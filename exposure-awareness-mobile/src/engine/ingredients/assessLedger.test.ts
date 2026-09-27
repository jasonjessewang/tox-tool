import { assessProduct } from "./assess";
import { buildLedger, weeklyIndexSeries, isActive } from "./ledger";
import { matchIngredients } from "./match";
import { parseIngredients, EMPTY_NUTRITION } from "./parse";
import type { ShelfItem } from "./types";
import type { UserProfile } from "../types";

const m = (text: string) => matchIngredients(parseIngredients(text));
const assess = (text: string, over: Partial<Parameters<typeof assessProduct>[0]> = {}) => {
  const r = m(text);
  return assessProduct({ matches: r.matches, unmatchedCount: r.unmatched.length, kind: "food", nova: null, frequency: "few_week", profile: null, ...over });
};

describe("assessment", () => {
  test("a clean list is 'nothing flagged', with an honest 'not a guarantee' caveat", () => {
    const a = assess("oats, water, salt");
    expect(a.stance).toBe("everyday_ok");
    expect(a.headline).toBe("Nothing in our database flagged");
    expect(a.caveats.join(" ")).toMatch(/only recognize what's in our database/);
  });

  test("where an ingredient sits on the label changes the verdict: same additive, main vs trace", () => {
    const trace = assess("water, oats, salt, flour, oil, milk, eggs, more, more2, BHT");
    const major = assess("BHT, BHA, sodium nitrite, water");
    expect(trace.signal).toBeLessThan(major.signal);
    expect(major.stance).not.toBe("everyday_ok");
  });

  test("frequency matters: the same product is a bigger deal daily than a couple of times a month", () => {
    const text = "sugar, yellow 5, red 40, oil";
    expect(assess(text, { frequency: "daily" }).signal).toBeGreaterThan(assess(text, { frequency: "rare" }).signal);
    expect(assess(text, { frequency: "rare" }).stance).not.toBe("consider_swap");
  });

  test("ultra-processed food adds to the signal for food but never for personal care", () => {
    const base = assess("oats, salt");
    expect(assess("oats, salt", { nova: 4 }).signal).toBeGreaterThan(base.signal);
    expect(assess("water, glycerin", { kind: "personal_care", nova: 4 }).signal).toBe(assess("water, glycerin", { kind: "personal_care" }).signal);
  });

  test("a profile changes it: pregnancy makes an endocrine-flagged ingredient matter more, with the reason shown", () => {
    const profile = { ageYears: 30, sex: "female", weightKg: 65, heightCm: 165, pregnant: true, breastfeeding: false, conditions: [], contentComplexity: "balanced", completedAt: "", locationEnabled: false, checkInTime: "off" } as UserProfile;
    const text = "water, methylparaben, propylparaben, parfum";
    const without = assess(text, { kind: "personal_care" });
    const withProfile = assess(text, { kind: "personal_care", profile });
    expect(withProfile.signal).toBeGreaterThan(without.signal);
    expect(withProfile.personal.length).toBeGreaterThan(0);
  });

  test("'fragrance' is described as unspecified, never asserted as phthalates", () => {
    const a = assess("water, fragrance", { kind: "personal_care" });
    expect(a.reasons[0].line).toMatch(/doesn't say what's in it/);
  });

  test("never alarmist: no stance headline uses fear vocabulary; suggestions come from the database", () => {
    for (const text of ["oats", "sugar, yellow 5, red 40", "BHT, BHA, sodium nitrite, sugar, red 40, yellow 5, titanium dioxide"]) {
      const a = assess(text, { frequency: "daily", nova: 4 });
      expect(a.headline.toLowerCase()).not.toMatch(/danger|toxic|deadly|unsafe|cancer/);
    }
    expect(assess("BHT, sodium nitrite, sugar").suggestions.length).toBeGreaterThan(0);
  });
});

const cereal = (over: Partial<ShelfItem> = {}): ShelfItem => ({
  id: "c", addedAt: "2026-01-01T00:00:00Z", removedAt: null, name: "Cereal", brand: "", kind: "food", barcode: null, source: "text",
  ingredientsText: "oats, sugar, salt, yellow 5, BHT", nova: 4,
  nutrition: { ...EMPTY_NUTRITION, calories: 200, sodiumMg: 300, addedSugarsG: 12, satFatG: 1 },
  frequency: "daily", servingsPerUse: 1, ...over,
});
const shampoo = (over: Partial<ShelfItem> = {}): ShelfItem => ({ ...cereal(), id: "s", name: "Shampoo", kind: "personal_care", ingredientsText: "water, sodium laureth sulfate, parfum, methylparaben", nutrition: null, nova: null, frequency: "few_week", ...over });

describe("intake ledger", () => {
  const at = new Date("2026-03-01T00:00:00Z");

  test("nutrients are real per-day estimates from declared amounts: 1 daily serving = the label amount", () => {
    const l = buildLedger([cereal()], at);
    const byKey = Object.fromEntries(l.nutrients.map((n) => [n.key, n]));
    expect(byKey.calories.perDay).toBe(200);
    expect(byKey.sodiumMg.perDay).toBe(300);
    expect(byKey.sodiumMg.pctDv).toBe(13); // 300 / 2300
    expect(byKey.addedSugarsG.pctDv).toBe(24); // 12 / 50
  });

  test("frequency scales the estimate: a few times a week is 3/7 of a daily serving", () => {
    const l = buildLedger([cereal({ frequency: "few_week" })], at);
    expect(l.nutrients.find((n) => n.key === "calories")!.perDay).toBeCloseTo(85.7, 1);
  });

  test("personal-care items contribute exposures but no nutrients; coverage says how much of the food side is quantified", () => {
    const l = buildLedger([cereal(), shampoo(), cereal({ id: "c2", nutrition: null })], at);
    expect(l.itemCount).toBe(3);
    expect(l.nutrientCoverage).toEqual({ withNutrition: 1, foodItems: 2 });
  });

  test("substances are tracked as frequency and a tier-weighted relative index -- not as a dose", () => {
    const l = buildLedger([cereal(), shampoo()], at);
    const sugar = l.substances.find((s) => s.substanceId === "added_sugar")!;
    expect(sugar.servingsPerWeek).toBe(7);
    expect(sugar.weighted).toBeGreaterThan(0);
    expect(sugar.sources[0].name).toBe("Cereal");
    const frag = l.substances.find((s) => s.substanceId === "phthalates")!;
    expect(frag.possibleOnly).toBe(true);
    expect(l.index).toBeGreaterThan(0);
  });

  test("themes roll substances up into the science concepts behind them", () => {
    const l = buildLedger([shampoo()], at);
    expect(l.themes.length).toBeGreaterThan(0);
    expect(l.themes[0].name.length).toBeGreaterThan(3);
  });

  test("items that were removed, or not added yet, don't count -- so history is reconstructable", () => {
    const removed = cereal({ removedAt: "2026-02-01T00:00:00Z" });
    expect(isActive(removed, at)).toBe(false);
    expect(buildLedger([removed], at).itemCount).toBe(0);
    expect(buildLedger([cereal({ addedAt: "2026-04-01T00:00:00Z" })], at).itemCount).toBe(0);
  });

  test("the weekly series shows the trend: index steps up when a product is added and down when removed", () => {
    const now = new Date("2026-03-01T00:00:00Z");
    const items = [shampoo({ addedAt: "2026-02-10T00:00:00Z", removedAt: "2026-02-24T00:00:00Z" })];
    const s = weeklyIndexSeries(items, 8, now);
    expect(s).toHaveLength(8);
    expect(s[0].index).toBe(0);
    expect(Math.max(...s.map((x) => x.index))).toBeGreaterThan(0);
    expect(s[7].index).toBe(0);
  });

  test("an empty shelf gives an empty, non-crashing ledger", () => {
    const l = buildLedger([], at);
    expect(l).toMatchObject({ itemCount: 0, index: 0, nutrients: [], substances: [] });
  });
});
