import { PILLARS, LESSONS, lessonsFor, estimateMinutes } from "./pillars";

test("exactly the three pillars: health, wealth, purpose", () => {
  expect(PILLARS.map((p) => p.key)).toEqual(["health", "wealth", "purpose"]);
});

test("every pillar has at least three lessons, ids unique, scripts a listenable length", () => {
  for (const p of PILLARS) expect(lessonsFor(p.key).length).toBeGreaterThanOrEqual(3);
  expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
  for (const l of LESSONS) {
    const words = l.script.split(/\s+/).length;
    expect(words).toBeGreaterThan(40);
    expect(words).toBeLessThan(200);
  }
});

test("no lesson makes detox, cure, or investment-return claims", () => {
  for (const l of LESSONS) {
    const t = l.script.toLowerCase();
    for (const bad of ["cure", "guaranteed", "get rich", "returns of"]) expect(t.includes(bad)).toBe(false);
  }
});

test("estimateMinutes is at least one minute", () => {
  expect(estimateMinutes("short")).toBe(1);
});
