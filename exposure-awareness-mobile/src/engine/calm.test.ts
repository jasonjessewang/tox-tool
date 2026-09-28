/**
 * Calm by design: the launch build is a checkup, not a feed. These tests hold the line so streaks, points, levels,
 * a plant that wilts while the app is closed, or reminders that are on before anyone asked for them, cannot come back
 * by accident (see engine/calm.ts and the launch plan's "don't build this" list).
 */
import * as fs from "fs";
import * as path from "path";
import { CALM_DEFAULTS, learningMomentsOn } from "./calm";
import { computePlant } from "./plant";

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
function sources(dir: string): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  for (const name of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, name.name);
    if (name.isDirectory()) out.push(...sources(rel));
    else if (/\.tsx?$/.test(name.name) && !/\.test\.tsx?$/.test(name.name)) out.push({ file: rel, text: read(rel) });
  }
  return out;
}
const UI = [...sources("src/screens"), ...sources("src/components"), { file: "App.tsx", text: read("App.tsx") }];

describe("defaults are quiet until the person chooses otherwise", () => {
  test("the daily check-in reminder starts off, and onboarding uses that default", () => {
    expect(CALM_DEFAULTS.checkInTime).toBe("off");
    expect(read("src/screens/onboarding/IntroScreen.tsx")).toContain("useState<CheckInTime>(CALM_DEFAULTS.checkInTime)");
  });

  test("learning moments between screens start off; absent means off", () => {
    expect(CALM_DEFAULTS.learningMoments).toBe(false);
    expect(learningMomentsOn(null)).toBe(false);
    expect(learningMomentsOn({})).toBe(false);
    expect(learningMomentsOn({ learningMoments: false })).toBe(false);
    expect(learningMomentsOn({ learningMoments: true })).toBe(true);
  });
});

describe("no streaks, points, levels or badges on any screen", () => {
  const forbidden: [RegExp, string][] = [
    [/\bXP\b/, "points (XP)"],
    [/day streak/i, "a streak counter"],
    [/\bBoss\b/, "a 'boss' step"],
    [/Level \{/, "a level number"],
    [/unlocked`/, "a badge-unlock message"],
    [/engine\/achievements/, "the badge engine"],
    [/evaluateAndUnlock/, "badge unlocking"],
  ];
  for (const [pattern, what] of forbidden) {
    test(`no screen or component shows ${what}`, () => {
      const offenders = UI.filter((s) => pattern.test(s.text)).map((s) => s.file);
      expect(offenders).toEqual([]);
    });
  }

  test("the badge catalog, kept only for the simulation's reports, has no streak badges", () => {
    const text = read("src/engine/achievements.ts");
    expect(text).not.toMatch(/key: "streak_/);
  });
});

describe("the plant never punishes time away", () => {
  test("whatever the gap since the last visit, it is never thirsty or wilting and never shows needs", () => {
    for (let done = 0; done <= 11; done++) {
      for (const days of [null, 0, 1, 3, 5, 10, 30, 365]) {
        for (let learn = 0; learn <= 7; learn++) {
          const p = computePlant({ starterDone: done, starterTotal: 11, daysSinceCare: days, learningDaysLast7: learn, checkInDaysLast7: 0 });
          expect(p.health).toBe("thriving");
          expect(p.needs).toEqual([]);
          expect(p.message).not.toMatch(/dry|thirsty|wilt/i);
        }
      }
    }
  });
});
