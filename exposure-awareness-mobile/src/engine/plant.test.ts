import { computePlant, stageFor } from "./plant";

const base = { starterDone: 3, starterTotal: 11, daysSinceCare: 0, learningDaysLast7: 1, checkInDaysLast7: 1 };

test("stage follows first-step completion and is 'mature' only when all are done", () => {
  expect(stageFor(0, 11)).toBe("seed");
  expect(stageFor(1, 11)).toBe("sprout");
  expect(stageFor(4, 11)).toBe("seedling");
  expect(stageFor(8, 11)).toBe("sapling");
  expect(stageFor(10, 11)).toBe("sapling");
  expect(stageFor(11, 11)).toBe("mature");
});

test("time away never costs anything: no thirst, no wilting, no needs (calm by design)", () => {
  for (const days of [null, 0, 3, 5, 30]) {
    const p = computePlant({ ...base, daysSinceCare: days });
    expect(p.health).toBe("thriving");
    expect(p.needs).toEqual([]);
  }
});

test("a full-grown plant learning on 2+ days in a week bears fruit, capped at 3, even after a long gap", () => {
  const mature = { ...base, starterDone: 11 };
  expect(computePlant({ ...mature, learningDaysLast7: 2 }).fruits).toBe(1);
  expect(computePlant({ ...mature, learningDaysLast7: 4 }).fruits).toBe(3);
  expect(computePlant({ ...mature, learningDaysLast7: 7 }).fruits).toBe(3);
  expect(computePlant({ ...mature, daysSinceCare: 20, learningDaysLast7: 3 }).fruits).toBe(2);
});

test("a full-grown plant with no learning this week simply has no fruit, and says how fruit comes", () => {
  const p = computePlant({ ...base, starterDone: 11, learningDaysLast7: 0 });
  expect(p.fruits).toBe(0);
  expect(p.message).toMatch(/fruit/);
});

test("only full-grown plants fruit", () => {
  expect(computePlant({ ...base, starterDone: 10, learningDaysLast7: 7 }).fruits).toBe(0);
});

test("messages count first steps, never quests or points", () => {
  expect(computePlant({ ...base, starterDone: 0 }).message).toMatch(/first step/);
  expect(computePlant(base).message).toBe("Growing -- 3 of 11 first steps done.");
});
