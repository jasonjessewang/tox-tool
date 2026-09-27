import { STARTER_JOURNEY, STARTER_JOURNEY_TOTAL_XP } from "./starterJourney";
import hazardDatabase from "./hazardDatabase.json";

test("every starter quest references real, existing substance ids", () => {
  const validIds = new Set((hazardDatabase as any).substances.map((s: any) => s.id));
  for (const quest of STARTER_JOURNEY) {
    for (const id of quest.substance_ids) {
      expect(validIds.has(id)).toBe(true);
    }
  }
});

test("starter journey orders start-with-the-easiest, hardest (radon) last", () => {
  const orders = STARTER_JOURNEY.map((q) => q.order);
  expect(orders).toEqual([...orders].sort((a, b) => a - b));
  expect(STARTER_JOURNEY[STARTER_JOURNEY.length - 1].id).toBe("starter_radon");
  expect(STARTER_JOURNEY[0].id).toBe("starter_tupperware");
});

test("total XP is the actual sum of quest XP, not a stale hardcoded number", () => {
  const computed = STARTER_JOURNEY.reduce((sum, q) => sum + q.xp, 0);
  expect(STARTER_JOURNEY_TOTAL_XP).toBe(computed);
});

test("quest ids are unique", () => {
  const ids = STARTER_JOURNEY.map((q) => q.id);
  expect(new Set(ids).size).toBe(ids.length);
});
