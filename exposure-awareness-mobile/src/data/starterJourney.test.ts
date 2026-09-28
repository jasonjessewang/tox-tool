import { STARTER_JOURNEY, BIG_STONE_STEP_IDS } from "./starterJourney";
import hazardDatabase from "./hazardDatabase.json";

test("every starter step references real, existing substance ids", () => {
  const validIds = new Set((hazardDatabase as any).substances.map((s: any) => s.id));
  for (const quest of STARTER_JOURNEY) {
    for (const id of quest.substance_ids) {
      expect(validIds.has(id)).toBe(true);
    }
  }
});

test("ordered by leverage: the big stones come first, radon at the top", () => {
  const orders = STARTER_JOURNEY.map((q) => q.order);
  expect(orders).toEqual([...orders].sort((a, b) => a - b));
  expect(STARTER_JOURNEY.slice(0, BIG_STONE_STEP_IDS.length).map((q) => q.id)).toEqual([...BIG_STONE_STEP_IDS]);
  expect(STARTER_JOURNEY[0].id).toBe("starter_radon");
});

test("steps carry no points", () => {
  for (const q of STARTER_JOURNEY) expect(Object.keys(q)).not.toContain("xp");
});

test("the water step reads the report before suggesting any filter", () => {
  const water = STARTER_JOURNEY.find((q) => q.id === "starter_water_filter")!;
  expect(water.action.indexOf("Report")).toBeGreaterThanOrEqual(0);
  expect(water.action.indexOf("Report")).toBeLessThan(water.action.indexOf("filter"));
});

test("ids are unique, and the ids people may already have completed are kept (they are storage keys)", () => {
  const ids = STARTER_JOURNEY.map((q) => q.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const kept of ["starter_tupperware", "starter_laundry", "starter_shoes_off", "starter_range_hood", "starter_shampoo_label", "starter_breakfast_swap", "starter_hvac_filter", "starter_water_filter", "starter_radon"]) {
    expect(ids).toContain(kept);
  }
});
