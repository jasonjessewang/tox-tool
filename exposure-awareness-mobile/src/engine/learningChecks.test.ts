/**
 * Recall practice: what is due when, how much has stuck, and that nothing here can lower a score or punish a slip.
 */
import { attemptsFrom, checkRef, nextChecks, parseCheckRef, recallSummary, statusOf, wrapUp, REVIEW_STEPS, type CheckAttempt } from "./learningChecks";
import { CONCEPT_CHECKS } from "../data/conceptChecks";

const Q = "f_hazard_risk.1";
const Q2 = "f_hazard_risk.2";
const R = new Set(["f_hazard_risk"]);
const at = (questionId: string, day: string, correct: boolean): CheckAttempt => ({ questionId, day, correct });

describe("the stored form", () => {
  test("an answer is an ordinary learning event, and reads back the same", () => {
    expect(checkRef("f_hazard_risk.1", true)).toBe("check:f_hazard_risk.1:1");
    expect(checkRef("f_hazard_risk.1", false)).toBe("check:f_hazard_risk.1:0");
    expect(parseCheckRef("check:f_hazard_risk.1:1")).toEqual({ questionId: "f_hazard_risk.1", correct: true });
    expect(parseCheckRef("check:f_hazard_risk.1:0")).toEqual({ questionId: "f_hazard_risk.1", correct: false });
    for (const not of ["curriculum:f_hazard_risk", "daily:x", "check:q", "check:q:2", "tool:risk_translator"]) expect(parseCheckRef(not)).toBeNull();
  });

  test("attempts come back oldest first; two answers on one day keep the order they were given in (storage is newest first)", () => {
    const stored = [
      { ref: checkRef(Q, true), date: "2026-09-10" }, // recorded last
      { ref: checkRef(Q, false), date: "2026-09-10" }, // recorded first, same day
      { ref: "daily:x", date: "2026-09-09" },
      { ref: checkRef(Q, false), date: "2026-09-01" },
    ];
    const a = attemptsFrom(stored);
    expect(a.map((x) => [x.day, x.correct])).toEqual([["2026-09-01", false], ["2026-09-10", false], ["2026-09-10", true]]);
    expect(statusOf(Q, a).lastCorrect).toBe(true); // the later answer of the day is the one that counts
  });
});

describe("when a question comes back", () => {
  test("never answered: nothing is due", () => {
    expect(statusOf(Q, [])).toMatchObject({ attempts: 0, dueOn: null, everCorrect: false });
  });

  test("right answers push it out along the schedule; the gaps widen and stop widening", () => {
    const day = (n: number) => `2026-01-${String(n).padStart(2, "0")}`;
    expect(statusOf(Q, [at(Q, day(1), true)])).toMatchObject({ streak: 1, dueOn: "2026-01-02" });
    expect(statusOf(Q, [at(Q, day(1), true), at(Q, day(2), true)])).toMatchObject({ streak: 2, dueOn: "2026-01-05" });
    const many = Array.from({ length: 9 }, (_, i) => at(Q, `2026-0${1 + Math.floor(i / 3)}-0${1 + (i % 3)}`, true));
    const s = statusOf(Q, many);
    expect(s.streak).toBe(9);
    const gap = Math.round((new Date(`${s.dueOn}T12:00:00`).getTime() - new Date(`${s.lastDay}T12:00:00`).getTime()) / 86400000);
    expect(gap).toBe(REVIEW_STEPS[REVIEW_STEPS.length - 1]); // every 90 days, for as long as it keeps being right
  });

  test("a wrong answer is not a failure: it comes back tomorrow and the streak starts again", () => {
    const s = statusOf(Q, [at(Q, "2026-01-01", true), at(Q, "2026-01-02", true), at(Q, "2026-01-05", false)]);
    expect(s).toMatchObject({ streak: 0, lastCorrect: false, dueOn: "2026-01-06", everCorrect: true }); // what was once recalled stays recalled
  });

  test("the schedule is 1, 3, 7, 14, 30, 60, then every 90 days", () => {
    expect([...REVIEW_STEPS]).toEqual([1, 3, 7, 14, 30, 60, 90]);
  });
});

describe("what to ask next", () => {
  test("nothing about a lesson that has not been read; nothing when nothing has been read", () => {
    expect(nextChecks(new Set(), [], "2026-09-25")).toEqual([]);
    expect(nextChecks(R, [], "2026-09-25").map((n) => n.check.lessonId)).toEqual(["f_hazard_risk", "f_hazard_risk"]);
    expect(nextChecks(new Set(["f_dose_response"]), [at(Q, "2026-09-01", true)], "2026-09-25").every((n) => n.check.lessonId === "f_dose_response")).toBe(true);
  });

  test("due questions come first, the longest overdue first; then the never-tried ones on lessons already read", () => {
    const attempts = [at(Q, "2026-09-01", true), at(Q2, "2026-09-20", true)]; // Q due 09-02, Q2 due 09-21
    const both = nextChecks(R, attempts, "2026-09-25", 5);
    expect(both.map((n) => [n.check.id, n.reason])).toEqual([[Q, "due"], [Q2, "due"]]);
    const fresh = nextChecks(new Set(["f_hazard_risk", "f_dose_response"]), attempts, "2026-09-25", 5);
    expect(fresh.slice(0, 2).map((n) => n.reason)).toEqual(["due", "due"]);
    expect(fresh.slice(2).map((n) => n.reason)).toEqual(["new", "new"]);
  });

  test("a question that is not due yet stays out of the way, and comes back on its day", () => {
    const attempts = [at(Q, "2026-09-25", true), at(Q2, "2026-09-25", true)];
    expect(nextChecks(R, attempts, "2026-09-25")).toEqual([]); // answered today: back tomorrow
    expect(nextChecks(R, attempts, "2026-09-26").map((n) => n.reason)).toEqual(["due", "due"]);
  });

  test("the limit is honoured", () => {
    expect(nextChecks(new Set(["f_hazard_risk", "f_dose_response", "f_relative_absolute"]), [], "2026-09-25", 2)).toHaveLength(2);
  });
});

describe("how much has stuck", () => {
  test("counts what could be asked, what was tried, what was answered right at least once, what is due and what is new", () => {
    const attempts = [at(Q, "2026-09-01", false), at(Q, "2026-09-02", true)];
    const r = recallSummary(R, attempts, "2026-09-25");
    expect(r).toEqual({ available: 2, attempted: 1, recalled: 1, due: 1, unanswered: 1 });
  });

  test("a slip after a right answer does not take the recall back", () => {
    const r = recallSummary(R, [at(Q, "2026-09-01", true), at(Q, "2026-09-10", false)], "2026-09-25");
    expect(r.recalled).toBe(1);
  });

  test("as of an earlier day, later answers do not exist yet", () => {
    const attempts = [at(Q, "2026-09-20", true)];
    expect(recallSummary(R, attempts, "2026-09-10").attempted).toBe(0);
    expect(recallSummary(R, attempts, "2026-09-20").recalled).toBe(1);
  });

  test("questions on lessons not yet read are not counted", () => {
    expect(recallSummary(new Set(), [at(Q, "2026-09-01", true)], "2026-09-25")).toEqual({ available: 0, attempted: 0, recalled: 0, due: 0, unanswered: 0 });
  });
});

test("every question in the set can be scheduled and summarized without error, whatever the answers", () => {
  const all = new Set(CONCEPT_CHECKS.map((c) => c.lessonId));
  const attempts = CONCEPT_CHECKS.flatMap((c, i) => [at(c.id, "2026-09-01", i % 2 === 0), at(c.id, "2026-09-05", i % 3 !== 0)]);
  const r = recallSummary(all, attempts, "2026-09-25");
  expect(r.available).toBe(CONCEPT_CHECKS.length);
  expect(r.attempted).toBe(CONCEPT_CHECKS.length);
  expect(r.recalled).toBeGreaterThan(0);
});

describe("wrapUp: what is said when the questions on a lesson are done", () => {
  test("says when the rest comes back, and never grades", () => {
    for (const total of [1, 2]) {
      for (let right = 0; right <= total; right++) {
        const text = wrapUp(right, total);
        expect(text).toMatch(/back|comes back|come back/);
        expect(text).not.toMatch(/\b(fail|failed|wrong|poor|bad|score of|grade)\b/i);
      }
    }
  });
  test("fits the number of questions", () => {
    expect(wrapUp(1, 1)).toMatch(/^You got it\. It comes back/);
    expect(wrapUp(2, 2)).toMatch(/^You got them all\. They come back/);
    expect(wrapUp(0, 2)).toMatch(/^These are new ideas/);
    expect(wrapUp(0, 1)).toMatch(/^That one is a new idea/);
    expect(wrapUp(1, 2)).toBe("1 of 2 the first time. The rest come back tomorrow, explained again.");
  });
});
