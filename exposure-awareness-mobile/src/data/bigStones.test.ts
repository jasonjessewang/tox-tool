/**
 * The big stones: the few sources that plausibly drive most of a person's exposure (launch plan, "Big stones first").
 * These five were missing before launch and are held here: they exist, they sit at the top concern level, they cite real
 * PubMed records, the Places checklist can find them, and ordinary logging picks them up without look-alike false alarms.
 */
import { loadHazardDb, scoreLogs } from "../engine/scoring";
import { PLACE_CHECKS } from "./placeChecks";
import { STARTER_JOURNEY } from "./starterJourney";
import type { LogStore } from "../engine/types";

const BIG_STONES = ["tobacco_smoke", "alcohol", "private_well_water", "carbon_monoxide", "work_dust_fumes"];
const substances = loadHazardDb();
const byId = new Map(substances.map((s) => [s.id, s]));

const EMPTY: LogStore = { food: [], products: [], environment: [], air_quality: [], practices: [] };
const meal = (food_item: string): LogStore["food"][number] => ({ id: "f", log_date: "2026-01-01", meal: "dinner", food_item, processing_level: null, notes: "", created_at: "2026-01-01T00:00:00.000Z" });
const flagged = (text: string) => {
  const report = scoreLogs({ ...EMPTY, food: [meal(text)] });
  return Object.values(report.category_summary).flatMap((c) => c?.substances.map((s) => s.id) ?? []);
};

test("each big stone exists at the top concern level, with a plain summary and at least two hand-picked PubMed references", () => {
  for (const id of BIG_STONES) {
    const s = byId.get(id) as any;
    expect(s).toBeDefined();
    expect(s.concern_level).toBe(3);
    expect(s.action_impact).toBe("high");
    expect(s.summary_plain.length).toBeGreaterThan(40);
    expect(s.references.length).toBeGreaterThanOrEqual(2);
    expect(s.references.map((r: any) => r.pmid)).toEqual(s.curated_pmids);
  }
});

test("fine particles (the top global risk factor for disease burden) now sit at the top concern level too", () => {
  expect(byId.get("pm25_particulate")!.concern_level).toBe(3);
});

test("the Places checklist can find smoke indoors, well water, carbon monoxide and work exposures", () => {
  const pointedAt = new Set(PLACE_CHECKS.map((c) => c.substanceId));
  for (const id of ["tobacco_smoke", "private_well_water", "carbon_monoxide", "work_dust_fumes"]) expect(pointedAt.has(id)).toBe(true);
  expect(PLACE_CHECKS.find((c) => c.id === "home_smoke")!.substanceId).toBe("tobacco_smoke");
});

test("the first steps point at the big stones they are about", () => {
  expect(STARTER_JOURNEY.find((q) => q.id === "starter_smoke_free")!.substance_ids).toContain("tobacco_smoke");
  expect(STARTER_JOURNEY.find((q) => q.id === "starter_water_filter")!.substance_ids).toContain("private_well_water");
});

test("logging a drink is picked up, whatever it is called", () => {
  for (const text of ["a glass of red wine", "two beers with friends", "soju at dinner", "whisky nightcap"]) expect(flagged(text)).toContain("alcohol");
});

test.each([
  ["shrimp cocktail", "alcohol"],
  ["ginger tea", "alcohol"],
  ["gingerbread cookie", "alcohol"],
  ["a well-cooked steak", "private_well_water"],
  ["smoked salmon bagel", "tobacco_smoke"],
])("'%s' does not flag %s", (text, id) => {
  expect(flagged(text)).not.toContain(id);
});
