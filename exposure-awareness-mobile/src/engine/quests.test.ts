import { computeLevel, DAILY_QUESTS, WEEKLY_QUESTS } from "./quests";

test("0 XP is level 1 with 50 needed for the next level", () => {
  const s = computeLevel(0);
  expect(s).toEqual({ totalXp: 0, level: 1, xpIntoLevel: 0, xpForNextLevel: 50 });
});

test("exactly 50 XP rolls over to level 2 with 0 progress into it", () => {
  const s = computeLevel(50);
  expect(s.level).toBe(2);
  expect(s.xpIntoLevel).toBe(0);
  expect(s.xpForNextLevel).toBe(100); // level 2 needs 2*50
});

test("49 XP stays level 1, one short", () => {
  const s = computeLevel(49);
  expect(s.level).toBe(1);
  expect(s.xpIntoLevel).toBe(49);
});

test("level curve is monotonically increasing in XP required", () => {
  let totalXp = 0;
  let prevLevel = 1;
  for (let i = 0; i < 500; i += 25) {
    const s = computeLevel(i);
    expect(s.level).toBeGreaterThanOrEqual(prevLevel);
    prevLevel = s.level;
  }
});

test("daily and weekly quest ids are each unique", () => {
  expect(new Set(DAILY_QUESTS.map((q) => q.id)).size).toBe(DAILY_QUESTS.length);
  expect(new Set(WEEKLY_QUESTS.map((q) => q.id)).size).toBe(WEEKLY_QUESTS.length);
});

test("no quest title or id references score/risk vocabulary -- same invariant as achievements", () => {
  const all = [...DAILY_QUESTS, ...WEEKLY_QUESTS];
  for (const q of all) {
    const text = (q.id + " " + q.title).toLowerCase();
    for (const forbidden of ["score", "risk", "concern", "band"]) {
      expect(text.includes(forbidden)).toBe(false);
    }
  }
});
