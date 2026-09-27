import { computePlant, stageFor } from "./plant";

const base = { starterDone: 3, starterTotal: 9, daysSinceCare: 0, learningDaysLast7: 1, checkInDaysLast7: 1 };

test("stage follows starter completion and only 'mature' when all are done", () => {
  expect(stageFor(0, 9)).toBe("seed");
  expect(stageFor(1, 9)).toBe("sprout");
  expect(stageFor(3, 9)).toBe("seedling");
  expect(stageFor(6, 9)).toBe("sapling");
  expect(stageFor(8, 9)).toBe("sapling");
  expect(stageFor(9, 9)).toBe("mature");
});

test("health follows care recency: thriving, thirsty, wilting", () => {
  expect(computePlant({ ...base, daysSinceCare: 2 }).health).toBe("thriving");
  expect(computePlant({ ...base, daysSinceCare: 3 }).health).toBe("thirsty");
  expect(computePlant({ ...base, daysSinceCare: 4 }).health).toBe("thirsty");
  expect(computePlant({ ...base, daysSinceCare: 5 }).health).toBe("wilting");
});

test("a brand-new seed with no care yet is not punished", () => {
  expect(computePlant({ ...base, starterDone: 0, daysSinceCare: null }).health).toBe("thriving");
  expect(computePlant({ ...base, starterDone: 2, daysSinceCare: null }).health).toBe("thirsty");
});

test("wilting always needs water, and any care fixes it (no lasting penalty)", () => {
  expect(computePlant({ ...base, daysSinceCare: 6 }).needs).toContain("water");
  expect(computePlant({ ...base, daysSinceCare: 0 }).health).toBe("thriving");
});

test("mature + healthy + learning on 2+ days bears fruit, capped at 3", () => {
  const mature = { ...base, starterDone: 9, daysSinceCare: 0 };
  expect(computePlant({ ...mature, learningDaysLast7: 2 }).fruits).toBe(1);
  expect(computePlant({ ...mature, learningDaysLast7: 4 }).fruits).toBe(3);
  expect(computePlant({ ...mature, learningDaysLast7: 7 }).fruits).toBe(3);
});

test("mature with no learning this week is thirsty and fruitless even if logging daily", () => {
  const p = computePlant({ ...base, starterDone: 9, daysSinceCare: 0, learningDaysLast7: 0 });
  expect(p.health).toBe("thirsty");
  expect(p.fruits).toBe(0);
  expect(p.needs).toContain("learn");
});

test("only mature plants fruit; an immature plant never does", () => {
  expect(computePlant({ ...base, starterDone: 8, learningDaysLast7: 7 }).fruits).toBe(0);
});

test("a wilting mature plant shows no fruit", () => {
  expect(computePlant({ ...base, starterDone: 9, daysSinceCare: 7, learningDaysLast7: 5 }).fruits).toBe(0);
});
