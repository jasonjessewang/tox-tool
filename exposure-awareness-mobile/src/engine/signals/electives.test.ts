/**
 * Elective modules and the Understanding part. Reading or answering anything elective may only add, never lower, and never moves
 * the core curriculum's own shares -- held on many random learning histories, not one that happened to be checked.
 */
import { Rng } from "../../sim/rng";
import { LESSONS, curriculumRef } from "../../data/curriculum";
import { MODULE_LESSONS } from "../../data/modules";
import { CONCEPT_CHECKS, MODULE_CHECKS, checksForLesson } from "../../data/conceptChecks";
import { checkRef } from "../learningChecks";
import { understandingSignal, ELECTIVE_BONUS_CAP, RECALL_BONUS_POINTS } from "./understanding";
import { makeData } from "./fixtures";
import type { SignalResult } from "./types";

const ASOF = "2026-09-30";
type Ev = { ref: string; date: string };
const day = (n: number) => `2026-09-${String(1 + (n % 28)).padStart(2, "0")}`;

function evaluate(events: Ev[]): SignalResult {
  const data = makeData({});
  // as storage keeps them: newest first
  data.learning = [...events].map((e, i) => ({ e, i })).sort((a, b) => (a.e.date === b.e.date ? a.i - b.i : a.e.date < b.e.date ? -1 : 1)).map((x) => x.e).reverse();
  return understandingSignal.evaluate({ asOf: ASOF, data });
}

/** A random learning life: some core lessons and questions, some electives and theirs. */
function randomHistory(r: Rng): Ev[] {
  const ev: Ev[] = [];
  const core = LESSONS.filter(() => r.chance(0.5));
  const electives = MODULE_LESSONS.filter(() => r.chance(0.4));
  for (const l of [...core, ...electives]) {
    ev.push({ ref: curriculumRef(l.id), date: day(r.int(0, 10)) });
    for (const c of checksForLesson(l.id)) if (r.chance(0.6)) ev.push({ ref: checkRef(c.id, r.chance(0.7)), date: day(r.int(11, 27)) });
  }
  return ev;
}
const curriculumRatio = (s: SignalResult) => s.parts.find((p) => p.label === "Curriculum")!.ratio;
const recallRatio = (s: SignalResult) => s.parts.find((p) => p.label === "Recall")?.ratio ?? null;

describe("electives only ever add", () => {
  test("reading one more elective lesson never lowers Understanding and leaves the core shares as they were", () => {
    const r = new Rng(311);
    let raised = 0;
    for (let i = 0; i < 300; i++) {
      const history = randomHistory(r);
      const read = new Set(history.map((e) => e.ref));
      const unread = MODULE_LESSONS.filter((l) => !read.has(curriculumRef(l.id)));
      if (unread.length === 0) continue;
      const before = evaluate(history);
      const after = evaluate([...history, { ref: curriculumRef(r.pick(unread).id), date: ASOF }]);
      expect(after.value).toBeGreaterThanOrEqual(before.value - 1e-9);
      expect(curriculumRatio(after)).toBe(curriculumRatio(before));
      expect(recallRatio(after)).toBe(recallRatio(before));
      if (after.value > before.value + 1e-9) raised += 1;
    }
    expect(raised).toBeGreaterThan(50); // it does count for something, not only "never lowers"
  });

  test("answering an elective question -- right or not -- never lowers Understanding", () => {
    const r = new Rng(313);
    for (let i = 0; i < 300; i++) {
      const history = randomHistory(r);
      const readElectives = MODULE_LESSONS.filter((l) => history.some((e) => e.ref === curriculumRef(l.id)));
      if (readElectives.length === 0) continue;
      const q = r.pick(checksForLesson(r.pick(readElectives).id));
      const before = evaluate(history).value;
      const after = evaluate([...history, { ref: checkRef(q.id, r.chance(0.5)), date: ASOF }]).value;
      expect(after).toBeGreaterThanOrEqual(before - 1e-9);
    }
  });

  test("the elective addition never exceeds its cap, even with every elective read and every question right", () => {
    const all: Ev[] = [];
    for (const l of MODULE_LESSONS) all.push({ ref: curriculumRef(l.id), date: day(1) });
    for (const c of MODULE_CHECKS) all.push({ ref: checkRef(c.id, true), date: day(3) });
    const coreOne = { ref: curriculumRef(LESSONS[0].id), date: day(0) };
    const base = evaluate([coreOne]).value;
    const withElectives = evaluate([coreOne, ...all]).value;
    expect(withElectives - base).toBeLessThanOrEqual(ELECTIVE_BONUS_CAP + 1e-9);
    expect(withElectives - base).toBeGreaterThan(ELECTIVE_BONUS_CAP - 1e-9); // and all of it is reachable
  });

  test("someone who reads only core lessons sees exactly the core reading: curriculum share plus recall, nothing else", () => {
    const r = new Rng(317);
    for (let i = 0; i < 100; i++) {
      const history = randomHistory(r).filter((e) => !MODULE_LESSONS.some((l) => e.ref === curriculumRef(l.id)) && !MODULE_CHECKS.some((c) => e.ref.startsWith(`check:${c.id}:`)));
      const s = evaluate(history);
      const pct = Math.round(curriculumRatio(s)! * 100);
      const recalled = CONCEPT_CHECKS.filter((c) => history.some((e) => e.ref === checkRef(c.id, true)) && history.some((e) => e.ref === curriculumRef(c.lessonId))).length;
      expect(s.value).toBeCloseTo(Math.min(100, pct + (RECALL_BONUS_POINTS * recalled) / CONCEPT_CHECKS.length), 6);
      expect(s.parts.some((p) => p.label === "Electives")).toBe(false);
    }
  });

  test("once an elective is read, a separate Electives line says what it counted, against what, in calm words", () => {
    const s = evaluate([{ ref: curriculumRef(LESSONS[0].id), date: day(0) }, { ref: curriculumRef(MODULE_LESSONS[0].id), date: day(1) }]);
    const part = s.parts.find((p) => p.label === "Electives")!;
    expect(part.measured).toBe(`1 of ${MODULE_LESSONS.length} elective lessons read`);
    expect(part.against).toMatch(/never counts against the core curriculum/);
    expect(`${part.measured} ${part.against}`).not.toMatch(/\b(risk|danger|toxic|unsafe|bad|fail|worse|poor)\b/i);
  });
});
