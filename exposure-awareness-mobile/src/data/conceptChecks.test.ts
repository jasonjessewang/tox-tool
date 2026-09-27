/**
 * The questions themselves: complete, well formed, grounded in the lessons, and calm.
 */
import { CONCEPT_CHECKS, checkById, checksForLesson } from "./conceptChecks";
import { LESSONS } from "./curriculum";

test("every lesson has two questions, and every question belongs to a real lesson", () => {
  for (const l of LESSONS) expect(checksForLesson(l.id)).toHaveLength(2);
  const ids = new Set(LESSONS.map((l) => l.id));
  for (const c of CONCEPT_CHECKS) expect(ids.has(c.lessonId)).toBe(true);
  expect(CONCEPT_CHECKS).toHaveLength(LESSONS.length * 2);
});

test("ids are unique and follow lesson.number; lookups work", () => {
  expect(new Set(CONCEPT_CHECKS.map((c) => c.id)).size).toBe(CONCEPT_CHECKS.length);
  for (const c of CONCEPT_CHECKS) {
    expect(c.id).toMatch(new RegExp(`^${c.lessonId}\\.[12]$`));
    expect(checkById(c.id)).toBe(c);
  }
});

test("each question has a prompt, an explanation, and 4 distinct options with the answer among them", () => {
  for (const c of CONCEPT_CHECKS) {
    expect(c.prompt.length).toBeGreaterThan(20);
    expect(c.explain.length).toBeGreaterThan(40);
    expect(c.options).toHaveLength(4);
    expect(new Set(c.options).size).toBe(4);
    for (const o of c.options) expect(o.trim().length).toBeGreaterThan(2);
    expect(c.answer).toBeGreaterThanOrEqual(0);
    expect(c.answer).toBeLessThan(c.options.length);
  }
});

test("the right answer is not always in the same place, and a question's answer never moves", () => {
  const counts = [0, 0, 0, 0];
  for (const c of CONCEPT_CHECKS) counts[c.answer] += 1;
  for (const n of counts) expect(n).toBeGreaterThanOrEqual(5); // 44 questions over 4 places: none starved
  expect(checkById("f_hazard_risk.1")!.answer).toBe(checkById("f_hazard_risk.1")!.answer);
});

test("the right answer is not given away by being the longest option every time", () => {
  const longest = CONCEPT_CHECKS.filter((c) => c.options[c.answer].length === Math.max(...c.options.map((o) => o.length))).length;
  expect(longest / CONCEPT_CHECKS.length).toBeLessThan(0.75); // a known way multiple choice teaches test-taking instead of the idea
});

test("questions ask about the lesson's own ideas: each explanation reuses words from its lesson", () => {
  for (const c of CONCEPT_CHECKS) {
    const lesson = LESSONS.find((l) => l.id === c.lessonId)!;
    const lessonText = `${lesson.title} ${lesson.headline} ${lesson.body.join(" ")} ${lesson.watchFor}`.toLowerCase();
    const words = [...new Set(c.explain.toLowerCase().match(/[a-z]{6,}/g) ?? [])];
    const shared = words.filter((w) => lessonText.includes(w));
    expect(shared.length).toBeGreaterThanOrEqual(2);
  }
});

test("the wording is calm: a wrong answer is never called a failure, and no fear vocabulary is added", () => {
  const words = /\b(you failed|failed|wrong answer|stupid|scary|terrifying|deadly)\b/i;
  for (const c of CONCEPT_CHECKS) for (const t of [c.prompt, c.explain, ...c.options]) expect(t).not.toMatch(words);
});
