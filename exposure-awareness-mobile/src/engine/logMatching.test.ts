/**
 * How the log scorer reads free text. These are the cases the engine soak run found misfiring:
 * an ordinary meal name lighting up an unrelated substance ("avocado toast" -> VOC off-gassing), and
 * "-free" claims counting as the thing they rule out.
 */
import { scoreLogs, loadHazardDb } from "./scoring";
import type { LogStore } from "./types";

const EMPTY: LogStore = { food: [], products: [], environment: [], air_quality: [], practices: [] };
const created_at = "2026-01-01T00:00:00.000Z";

const meal = (food_item: string, notes = ""): LogStore["food"][number] => ({ id: "f", log_date: "2026-01-01", meal: "lunch", food_item, processing_level: null, notes, created_at });
const flaggedIds = (logs: Partial<LogStore>) => {
  const report = scoreLogs({ ...EMPTY, ...logs });
  return Object.values(report.category_summary).flatMap((c) => c?.substances.map((s) => s.id) ?? []);
};

describe("ordinary meals are not flagged by look-alike words", () => {
  test.each([
    ["avocado toast with a poached egg", "voc_off_gassing"],
    ["smoked salmon bagel", "pm25_particulate"],
    ["70 percent dark chocolate", "dry_cleaning_perc"],
    ["vegetable bhaji", "bha_bht"],
    ["cream of mushroom soup, secured a table by the window", "sodium_nitrite"],
    ["a candlelit dinner", "candle_incense_pm"],
    ["a calm sleep rhythm all week", "chlorination_byproducts"],
  ])("'%s' does not flag %s", (text, id) => {
    expect(flaggedIds({ food: [meal(text)] })).not.toContain(id);
  });

  test("the false VOC hit no longer reaches the Focus list", () => {
    const report = scoreLogs({ ...EMPTY, food: Array.from({ length: 5 }, () => meal("avocado toast")) });
    expect(report.overall_score).toBe(0);
    expect(report.focus_items).toHaveLength(0);
  });
});

describe("'-free' and 'no ...' claims do not count as the thing they rule out", () => {
  test.each([
    ["sugar-free gum", "added_sugar"],
    ["BPA-free can of beans", "bpa"],
    ["fragrance-free lotion", "phthalates"],
    ["paraben free shampoo", "parabens"],
    ["no added sugar oatmeal", "added_sugar"],
  ])("'%s' does not flag %s", (text, id) => {
    expect(flaggedIds({ food: [meal(text)] })).not.toContain(id);
    expect(flaggedIds({ products: [{ id: "p", log_date: "2026-01-01", product_type: "care", product_name: text, ingredients_text: "", notes: "", created_at }] })).not.toContain(id);
  });

  test("a mention next to a claim still counts", () => {
    expect(flaggedIds({ food: [meal("BPA-free bottle, but a BPA-lined can of soup")] })).toContain("bpa");
  });
});

describe("real mentions still flag", () => {
  test.each([
    ["cereal with red 40 and added sugar", "artificial_food_dyes"],
    ["hot dogs and bacon", "sodium_nitrite"],
    ["canned chili (BPA-lined can lining)", "bpa"],
    ["takeout in a grease-resistant wrapper", "pfas_packaging"],
    ["high-fructose corn syrup soda", "added_sugar"],
    ["two glasses of bottled water", "microplastics_bottled_water"],
  ])("'%s' flags %s", (text, id) => {
    expect(flaggedIds({ food: [meal(text)] })).toContain(id);
  });

  test("environment notes flag on the phrase, not on fragments", () => {
    const env = (condition_type: string, detail: string) => ({ id: "e", log_date: "2026-01-01", location: "Home", condition_type, detail, notes: "", created_at });
    expect(flaggedIds({ environment: [env("Gas stove", "cooked with the gas stove on all evening")] })).toContain("nitrogen_dioxide_gas_stove");
    expect(flaggedIds({ environment: [env("Mold", "black mold behind the sink")] })).toContain("mold_indoor");
    expect(flaggedIds({ environment: [env("Air", "hazy, wildfire smoke")] })).toContain("pm25_particulate");
  });
});

describe("properties over the whole hazard database", () => {
  const substances = loadHazardDb();

  test("every substance is found by its own full name, the way a product note lists what it contains", () => {
    for (const s of substances) {
      const notes = `Contains: ${s.name}.`;
      expect({ id: s.id, flagged: flaggedIds({ food: [meal("Snack", notes)] }).includes(s.id) }).toEqual({ id: s.id, flagged: true });
    }
  });

  test("every alias is found on its own, and stops being found once it is negated", () => {
    for (const s of substances) {
      for (const alias of s.aliases ?? []) {
        const plain = flaggedIds({ food: [meal(`lunch with ${alias}`)] }).includes(s.id);
        const negated = flaggedIds({ food: [meal(`lunch with ${alias}-free`)] }).includes(s.id);
        expect({ id: s.id, alias, plain, negated }).toEqual({ id: s.id, alias, plain: true, negated: false });
      }
    }
  });
});

describe("produce tally uses the same reading", () => {
  test("singular produce words count, and look-alike words do not", () => {
    const report = scoreLogs({ ...EMPTY, food: [meal("banana and avocado toast"), meal("one strawberry"), meal("pineapple chunks"), meal("the doorbell rang")] });
    expect(report.produce_summary.lower_hits).toEqual({ bananas: 1, avocados: 1, pineapple: 1 });
    expect(report.produce_summary.watch_hits).toEqual({ strawberries: 1 });
  });
});
