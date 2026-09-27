import { directionFrom, journeyPosition, TREND_LABELS } from "./fusion";
import type { WeeklyPoint } from "./trends";

/** A week: exposure points, practices logged, and (by default) a typical 20 entries of evidence behind the points. */
function point(overallScore: number, practicesLogged: number, entriesLogged = 20): WeeklyPoint {
  return { weekLabel: "x", weekStart: "2026-01-01", weekEnd: "2026-01-07", overallScore, entriesLogged, practicesLogged, quickWinsCompleted: 0 };
}
const weeks = (scores: number[], practices: number[] = scores.map(() => 0)) => scores.map((s, i) => point(s, practices[i]));

describe("needs enough history to say anything", () => {
  test("fewer than 2 active weeks reports not_enough_data, not a fake direction", () => {
    const history = [point(0, 0, 0), point(0, 0, 0), point(3, 1)];
    expect(directionFrom(history, "overallScore", false)).toBe("not_enough_data");
  });

  test("a week with nothing logged at all is absence, not a trend", () => {
    const history = [...weeks([8, 9, 8]), point(0, 0, 0)];
    expect(directionFrom(history, "overallScore", false)).toBe("not_enough_data");
    expect(directionFrom(history, "practicesLogged", true)).toBe("not_enough_data");
  });

  test("a clean week with plenty logged is real data, not an inactive week", () => {
    const history = [...weeks([6, 7]), point(0, 0, 18)];
    expect(directionFrom(history, "overallScore", false)).toBe("improving");
  });
});

describe("exposure score: lower is better", () => {
  test("a drop well beyond the usual week-to-week wobble is 'improving'", () => {
    expect(directionFrom(weeks([8, 9, 8, 9, 2]), "overallScore", false)).toBe("improving");
  });

  test("a rise well beyond the usual wobble is 'worsening'", () => {
    expect(directionFrom(weeks([2, 3, 2, 3, 9]), "overallScore", false)).toBe("worsening");
  });

  test("with only two active weeks, a clear step still counts", () => {
    expect(directionFrom(weeks([7, 2]), "overallScore", false)).toBe("improving");
  });

  test("a change inside this person's own range is 'flat', not a trend (the old rule called it improving)", () => {
    // usual weeks swing between 3 and 9; landing on 5 is an ordinary week
    expect(directionFrom(weeks([4, 9, 3, 8, 5]), "overallScore", false)).toBe("flat");
  });

  test("a one- or two-point difference is never enough on its own", () => {
    expect(directionFrom(weeks([5, 5, 5, 5, 3]), "overallScore", false)).toBe("flat");
    expect(directionFrom(weeks([5, 5, 5, 5, 7]), "overallScore", false)).toBe("flat");
  });

  test("equal consecutive weeks report 'flat'", () => {
    expect(directionFrom(weeks([1, 4, 4]), "overallScore", false)).toBe("flat");
  });
});

describe("exposure score: logging volume must be comparable", () => {
  test("a much quieter week scores lower just because less was written down -> not_enough_data, not 'improving'", () => {
    const history = [...weeks([8, 9, 8, 9]), point(1, 0, 4)];
    expect(directionFrom(history, "overallScore", false)).toBe("not_enough_data");
  });

  test("a much busier week scores higher just because more was written down -> not_enough_data, not 'worsening'", () => {
    const history = [...weeks([2, 3, 2, 3]), point(9, 0, 60)];
    expect(directionFrom(history, "overallScore", false)).toBe("not_enough_data");
  });

  test("moderately different volume still compares", () => {
    const history = [...weeks([8, 9, 8, 9]), point(1, 0, 14)];
    expect(directionFrom(history, "overallScore", false)).toBe("improving");
  });

  test("practices are not volume-gated", () => {
    const history = [point(3, 1, 30), point(3, 1, 30), point(3, 6, 4)];
    expect(directionFrom(history, "practicesLogged", true)).toBe("improving");
  });
});

describe("practices: higher is better", () => {
  test("a rise beyond the usual range is 'improving'", () => {
    expect(directionFrom(weeks([3, 3, 3, 3], [1, 2, 1, 5]), "practicesLogged", true)).toBe("improving");
  });

  test("a fall beyond the usual range is 'worsening' in the engine's terms", () => {
    expect(directionFrom(weeks([3, 3, 3, 3], [6, 5, 6, 1]), "practicesLogged", true)).toBe("worsening");
  });

  test("one practice more or fewer is an ordinary week", () => {
    expect(directionFrom(weeks([3, 3, 3, 3], [3, 3, 3, 4]), "practicesLogged", true)).toBe("flat");
  });
});

describe("wording", () => {
  test("labels are neutral: a direction is information, not a verdict", () => {
    const all = Object.values(TREND_LABELS).flatMap((m) => Object.values(m)).join(" ").toLowerCase();
    for (const forbidden of ["worse", "worsening", "bad", "danger", "risk", "toxic", "unsafe", "alarm", "decline", "fail"]) {
      expect(all).not.toContain(forbidden);
    }
  });

  test("arrows point the way the metric moved: exposure easing goes down, practices growing go up", () => {
    expect(TREND_LABELS.exposure.improving).toMatch(/↓/);
    expect(TREND_LABELS.exposure.worsening).toMatch(/↑/);
    expect(TREND_LABELS.practices.improving).toMatch(/↑/);
    expect(TREND_LABELS.practices.worsening).toMatch(/↓/);
  });
});

test("journey position moves from Getting Started through Deep in the Journey", () => {
  expect(journeyPosition(0, 1)).toBe("Getting Started");
  expect(journeyPosition(10, 1)).toBe("Getting Started");
  expect(journeyPosition(30, 1)).toBe("Building Momentum");
  expect(journeyPosition(80, 1)).toBe("Maintaining");
  expect(journeyPosition(100, 1)).toBe("Maintaining"); // 100% but low level isn't "deep" yet
  expect(journeyPosition(100, 3)).toBe("Deep in the Journey");
});
