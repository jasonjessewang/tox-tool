/**
 * The elective modules: well formed, reachable, grounded in their own lessons, calm, and kept out of the core curriculum's
 * denominators (so adding one never lowers anybody's tier or Understanding).
 */
import { LESSONS } from "./curriculum";
import { MODULE_LESSONS, MODULE_INFO, MODULE_ORDER, ALL_LESSONS, anyLessonById, lessonsInModule } from "./modules";
import { CONCEPT_CHECKS, MODULE_CHECKS, ALL_CHECKS, checksForLesson, checkById } from "./conceptChecks";
import { evidenceById } from "../engine/evidence";

const lessonText = (id: string) => {
  const l = anyLessonById(id)!;
  return `${l.title} ${l.headline} ${l.body.join(" ")} ${l.watchFor}`.toLowerCase();
};
/** quoted claims ('non-toxic', "detected in") are the thing being examined, not the app's own voice */
const unquoted = (t: string) => t.replace(/'[^']*'|"[^"]*"|‘[^’]*’|“[^”]*”/g, " ");

describe("module lessons", () => {
  test("every module is listed, has lessons, and every lesson belongs to a listed module", () => {
    expect(new Set(MODULE_ORDER)).toEqual(new Set(Object.keys(MODULE_INFO)));
    for (const m of MODULE_ORDER) expect(lessonsInModule(m).length).toBeGreaterThanOrEqual(3);
    for (const l of MODULE_LESSONS) expect(MODULE_ORDER).toContain(l.module);
  });

  test("ids are unique across the core curriculum and the modules", () => {
    const ids = ALL_LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("each lesson is complete: one idea, what to watch for, and a conversation to have", () => {
    for (const l of MODULE_LESSONS) {
      expect(l.title.length).toBeGreaterThan(10);
      expect(l.headline.length).toBeGreaterThan(40);
      expect(l.body.length).toBeGreaterThanOrEqual(2);
      for (const p of l.body) expect(p.length).toBeGreaterThan(80);
      expect(l.watchFor.length).toBeGreaterThan(30);
      expect(l.talkAbout.length).toBeGreaterThan(30);
    }
  });

  test("prerequisites exist, are open from day one (Foundations or another module lesson), and never loop", () => {
    const foundations = new Set(LESSONS.filter((l) => l.tier === 1).map((l) => l.id));
    const moduleIds = new Set(MODULE_LESSONS.map((l) => l.id));
    for (const l of MODULE_LESSONS) {
      expect(l.prereqs.length).toBeGreaterThan(0);
      for (const p of l.prereqs) expect({ lesson: l.id, prereq: p, ok: foundations.has(p) || moduleIds.has(p) }).toEqual({ lesson: l.id, prereq: p, ok: true });
    }
    // walking prerequisites from any lesson always ends at the Foundations tier
    const reachesFoundations = (id: string, seen: Set<string> = new Set()): boolean => {
      if (foundations.has(id)) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      const l = MODULE_LESSONS.find((x) => x.id === id)!;
      return l.prereqs.every((p) => reachesFoundations(p, seen));
    };
    for (const l of MODULE_LESSONS) expect({ lesson: l.id, ok: reachesFoundations(l.id) }).toEqual({ lesson: l.id, ok: true });
  });

  test("the research attached to a lesson exists in the evidence library", () => {
    for (const l of MODULE_LESSONS) for (const id of l.evidenceIds ?? []) expect({ lesson: l.id, id, found: !!evidenceById(id) }).toEqual({ lesson: l.id, id, found: true });
  });

  test("calm voice: no fear vocabulary in the app's own wording", () => {
    const words = /\b(deadly|danger|dangerous|scary|terrifying|toxic|poisonous|cancer-causing|you are at risk|alarming)\b/i;
    for (const l of MODULE_LESSONS) {
      for (const t of [l.title, l.headline, ...l.body, l.watchFor, l.talkAbout]) expect({ lesson: l.id, text: unquoted(t).match(words)?.[0] ?? null }).toEqual({ lesson: l.id, text: null });
    }
  });

  test("no lesson blames: the cancer lessons say plainly that a diagnosis is not a verdict on choices", () => {
    const cancer = lessonsInModule("cancer").map((l) => `${l.body.join(" ")} ${l.watchFor}`).join(" ").toLowerCase();
    expect(cancer).toContain("never a verdict");
    expect(cancer).toContain("not a verdict on effort");
    expect(cancer).toContain("guilt");
  });

  test("modules stay out of the core curriculum's lists", () => {
    const core = new Set(LESSONS.map((l) => l.id));
    for (const l of MODULE_LESSONS) expect(core.has(l.id)).toBe(false);
    for (const c of MODULE_CHECKS) expect(CONCEPT_CHECKS).not.toContain(c);
  });
});

describe("module questions", () => {
  test("every module lesson has two questions, each belonging to a real module lesson, with lesson.number ids", () => {
    for (const l of MODULE_LESSONS) expect(checksForLesson(l.id)).toHaveLength(2);
    const ids = new Set(MODULE_LESSONS.map((l) => l.id));
    for (const c of MODULE_CHECKS) {
      expect(ids.has(c.lessonId)).toBe(true);
      expect(c.id).toMatch(new RegExp(`^${c.lessonId}\\.[12]$`));
      expect(checkById(c.id)).toBe(c);
    }
    expect(MODULE_CHECKS).toHaveLength(MODULE_LESSONS.length * 2);
    expect(new Set(ALL_CHECKS.map((c) => c.id)).size).toBe(ALL_CHECKS.length);
  });

  test("each question has a prompt, an explanation and 4 distinct options with the answer among them", () => {
    for (const c of MODULE_CHECKS) {
      expect(c.prompt.length).toBeGreaterThan(20);
      expect(c.explain.length).toBeGreaterThan(40);
      expect(c.options).toHaveLength(4);
      expect(new Set(c.options).size).toBe(4);
      expect(c.answer).toBeGreaterThanOrEqual(0);
      expect(c.answer).toBeLessThan(4);
    }
  });

  test("the right answer moves around and is not given away by being the longest option", () => {
    const counts = [0, 0, 0, 0];
    for (const c of MODULE_CHECKS) counts[c.answer] += 1;
    for (const n of counts) expect(n).toBeGreaterThanOrEqual(4);
    const longest = MODULE_CHECKS.filter((c) => c.options[c.answer].length === Math.max(...c.options.map((o) => o.length))).length;
    expect(longest / MODULE_CHECKS.length).toBeLessThan(0.5);
  });

  test("questions ask about the lesson's own ideas: each explanation reuses words from its lesson", () => {
    for (const c of MODULE_CHECKS) {
      const text = lessonText(c.lessonId);
      const words = [...new Set(c.explain.toLowerCase().match(/[a-z]{6,}/g) ?? [])];
      expect({ id: c.id, shared: words.filter((w) => text.includes(w)).length >= 3 }).toEqual({ id: c.id, shared: true });
    }
  });

  test("the wording is calm: a wrong answer is never a failure, and no fear vocabulary is added", () => {
    const words = /\b(you failed|failed|wrong answer|stupid|scary|terrifying|deadly|dangerous)\b/i;
    for (const c of MODULE_CHECKS) for (const t of [c.prompt, c.explain, ...c.options]) expect(t).not.toMatch(words);
  });
});
