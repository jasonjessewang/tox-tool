import { computeLiteracy } from "./literacy";
import { LESSONS, lessonsInTier, lessonById } from "../data/curriculum";
import { loadEvidence } from "./evidence";

const ids = (t: 1 | 2 | 3) => lessonsInTier(t).map((l) => l.id);

test("a new user is in tier 1 with tiers 2 and 3 locked, and the first lesson is next", () => {
  const l = computeLiteracy(new Set());
  expect(l.tier).toBe(1);
  expect(l.tiers.map((t) => t.unlocked)).toEqual([true, false, false]);
  expect(l.next?.id).toBe("f_hazard_risk");
});

test("finishing 80% of Foundations unlocks Practitioner, but not before", () => {
  const f = ids(1);
  expect(computeLiteracy(new Set(f.slice(0, 6))).tiers[1].unlocked).toBe(false);
  const l = computeLiteracy(new Set(f.slice(0, 7)));
  expect(l.tiers[1].unlocked).toBe(true);
  expect(l.tier).toBe(2);
});

test("Advanced needs Practitioner, which needs Foundations (no skipping)", () => {
  const onlyPractitioner = computeLiteracy(new Set(ids(2)));
  expect(onlyPractitioner.tiers[2].unlocked).toBe(false);
  const all = computeLiteracy(new Set([...ids(1), ...ids(2)]));
  expect(all.tier).toBe(3);
});

test("completing everything reaches 100% and no next lesson", () => {
  const l = computeLiteracy(new Set(LESSONS.map((x) => x.id)));
  expect(l.pct).toBe(100);
  expect(l.next).toBe(null);
  expect(l.status).toMatch(/on your own/);
});

test("curriculum quality: single idea per lesson, a watch-for and a conversation starter on all", () => {
  expect(LESSONS.length).toBe(22);
  expect(new Set(LESSONS.map((l) => l.id)).size).toBe(22);
  for (const l of LESSONS) {
    expect(l.headline.length).toBeGreaterThan(30);
    expect(l.body.length).toBeGreaterThanOrEqual(2);
    expect(l.watchFor.length).toBeGreaterThan(20);
    expect(l.talkAbout.endsWith("?") || l.talkAbout.endsWith(".")).toBe(true);
  }
});

test("every lesson's evidence reference points at a real item in the evidence library", () => {
  const known = new Set(loadEvidence().map((e) => e.id));
  for (const l of LESSONS) for (const id of l.evidenceIds ?? []) expect(known.has(id)).toBe(true);
  expect(lessonById("p_ci")?.evidenceIds).toContain("pmid_38446676");
});

test("tone: lessons never promise certainty or use alarm language", () => {
  for (const l of LESSONS) {
    const t = [l.headline, ...l.body].join(" ").toLowerCase();
    for (const bad of ["you will get", "deadly", "proves that", "guaranteed"]) expect(t.includes(bad)).toBe(false);
  }
});
