import { composeWellnessScore, compareWithEarlier, normalizeWeights, describeScore, showsNumber, DEFAULT_WEIGHTS, BAND_INFO, EARLY_PICTURE, NUMBER_MIN_COVERAGE, PROVISIONAL_COVERAGE, COMPONENT_INFO, type WellnessScore } from "./wellnessScore";
import { SIGNALS } from "./signals/registry";
import type { SignalKey, SignalResult } from "./signals/types";
import { Rng } from "../sim/rng";

const KEYS = SIGNALS.map((s) => s.key);
const result = (key: SignalKey, value: number, confidence = 1): SignalResult => ({ key, value, confidence, parts: [], summary: `${key} summary`, notes: [] });
const all = (values: Partial<Record<SignalKey, [number, number?]>>): SignalResult[] => KEYS.map((k) => result(k, values[k]?.[0] ?? 0, values[k]?.[1] ?? 0));
const score = (values: Partial<Record<SignalKey, [number, number?]>>, weights = DEFAULT_WEIGHTS) => composeWellnessScore(all(values), weights, "2026-09-25");
const comp = (s: WellnessScore, key: SignalKey) => s.components.find((c) => c.key === key)!;

test("default weights sum to 100 and every part has a label and a blurb", () => {
  expect(Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
  for (const k of KEYS) {
    expect(COMPONENT_INFO[k].label.length).toBeGreaterThan(3);
    expect(COMPONENT_INFO[k].blurb.length).toBeGreaterThan(20);
  }
});

describe("a brand-new person", () => {
  const s = score({});
  test("has no picture yet: zero coverage, an early reading, never a hidden number", () => {
    expect(s.overall).toBe(0);
    expect(s.coverage).toBe(0);
    expect(s.provisional).toBe(true);
    expect(s.band).toBe("building");
    for (const c of s.components) expect(c.influence).toBe(0);
    expect(describeScore(s).label).toBe(EARLY_PICTURE.label);
  });
});

describe("what counts in the score", () => {
  test("a part with no evidence is neither a drag nor a prop: it is simply not in the picture", () => {
    const withGhost = score({ exposure: [80, 1], shelf: [80, 1], resilience: [0, 0], learning: [0, 0] });
    const alone = composeWellnessScore(all({ exposure: [80, 1], shelf: [80, 1] }), DEFAULT_WEIGHTS);
    expect(withGhost.overall).toBe(80);
    expect(alone.overall).toBe(80);
  });

  test("the overall is the evidence-weighted average of the parts, using the user's weights", () => {
    const s = score({ exposure: [100, 1], shelf: [40, 1] }, { exposure: 30, resilience: 25, validation: 15, shelf: 15, places: 20, learning: 15 });
    // weights 30 and 15 of (30 + 15): (30 * 100 + 15 * 40) / 45 = 80
    expect(s.overall).toBe(80);
    expect(comp(s, "exposure").influence).toBeCloseTo(66.7, 1);
    expect(comp(s, "shelf").influence).toBeCloseTo(33.3, 1);
  });

  test("less evidence means less say", () => {
    const sure = score({ exposure: [100, 1], shelf: [40, 1] });
    const unsure = score({ exposure: [100, 1], shelf: [40, 0.25] });
    expect(unsure.overall).toBeGreaterThan(sure.overall);
    expect(comp(unsure, "shelf").influence).toBeLessThan(comp(sure, "shelf").influence);
  });

  test("coverage is the weight-and-evidence share of the whole picture", () => {
    const s = score({ exposure: [90, 1], shelf: [20, 1], places: [60, 1] });
    expect(s.coverage).toBe(DEFAULT_WEIGHTS.exposure + DEFAULT_WEIGHTS.shelf + DEFAULT_WEIGHTS.places);
    expect(s.provisional).toBe(false);
    const thin = score({ learning: [20, 1] });
    expect(thin.coverage).toBe(DEFAULT_WEIGHTS.learning);
    expect(thin.provisional).toBe(true);
    expect(PROVISIONAL_COVERAGE).toBeGreaterThan(DEFAULT_WEIGHTS.learning);
    expect(PROVISIONAL_COVERAGE).toBeLessThan(DEFAULT_WEIGHTS.exposure + DEFAULT_WEIGHTS.shelf + DEFAULT_WEIGHTS.places);
  });

  test("contributions add up to the overall score", () => {
    const s = score({ exposure: [83, 0.9], resilience: [61, 0.7], validation: [100, 1], shelf: [47, 0.5], places: [72, 0.6], learning: [30, 1] });
    const summed = s.components.reduce((sum, c) => sum + c.contribution, 0);
    expect(Math.abs(summed - s.overall)).toBeLessThanOrEqual(1);
    expect(s.components.reduce((sum, c) => sum + c.influence, 0)).toBeCloseTo(100, 0);
  });

  test("a zero weight removes a part's influence entirely", () => {
    const s = score({ exposure: [100, 1], learning: [0, 1] }, { ...DEFAULT_WEIGHTS, learning: 0 });
    expect(comp(s, "learning").influence).toBe(0);
    expect(s.overall).toBe(100);
  });

  test("weights are normalized to 100, negative or missing ones cope, and new parts get their default", () => {
    const w1 = normalizeWeights({ exposure: 1, resilience: 1, validation: 1, shelf: 1, places: 1, learning: 1 });
    expect(Object.values(w1).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    const w2 = normalizeWeights({ exposure: -5 });
    expect(Object.values(w2).every((v) => Number.isFinite(v) && v >= 0)).toBe(true);
    expect(w2.exposure).toBe(0);
    const w3 = normalizeWeights({ exposure: 100 }); // a part the stored weights predate falls back to its default
    for (const k of KEYS) expect(w3[k]).toBeGreaterThanOrEqual(0);
    expect(Object.values(w3).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    expect(normalizeWeights({ exposure: 0, resilience: 0, validation: 0, shelf: 0, learning: 0, places: 0 } as never)).toEqual(normalizeWeights({}));
  });
});

describe("properties: improving things never lowers the score", () => {
  test("raising any part's value never lowers the overall; more evidence pulls the overall toward that part's value", () => {
    const r = new Rng(11);
    for (let i = 0; i < 300; i++) {
      const base = Object.fromEntries(KEYS.map((k) => [k, [r.range(0, 100), r.range(0.05, 1)] as [number, number]])) as Record<SignalKey, [number, number]>;
      const key = r.pick(KEYS);
      const before = score(base);
      const raised = score({ ...base, [key]: [Math.min(100, base[key][0] + r.range(1, 30)), base[key][1]] });
      expect(raised.overall).toBeGreaterThanOrEqual(before.overall - 1); // rounding

      const more = score({ ...base, [key]: [base[key][0], Math.min(1, base[key][1] + 0.2)] });
      const total = before.overall;
      if (base[key][0] > total + 1) expect(more.overall).toBeGreaterThanOrEqual(total - 1);
      if (base[key][0] < total - 1) expect(more.overall).toBeLessThanOrEqual(total + 1);
    }
  });
});

describe("bands", () => {
  const full = (v: number) => score(Object.fromEntries(KEYS.map((k) => [k, [v, 1]])) as never);
  test("thresholds", () => {
    expect(full(20).band).toBe("building");
    expect(full(35).band).toBe("steady");
    expect(full(60).band).toBe("strong");
    expect(full(80).band).toBe("excellent");
  });

  test("while the picture is thin the band stays 'building' whatever the number says", () => {
    const s = score({ learning: [100, 1] });
    expect(s.overall).toBe(100);
    expect(s.provisional).toBe(true);
    expect(s.band).toBe("building");
    expect(describeScore(s).description).toBe(EARLY_PICTURE.description); // the share filled in is shown beside it, not repeated in it
    expect(s.coverage).toBe(DEFAULT_WEIGHTS.learning);
  });

  test("labels never use fear vocabulary", () => {
    for (const b of [...Object.values(BAND_INFO), EARLY_PICTURE]) {
      const t = `${b.label} ${b.description}`.toLowerCase();
      for (const bad of ["risk", "danger", "toxic", "unsafe", "bad", "fail", "worse"]) expect(t.includes(bad)).toBe(false);
    }
  });
});

describe("compared with your own earlier self", () => {
  const now = score({ exposure: [80, 1], resilience: [60, 1], shelf: [70, 0.2] });
  const before = score({ exposure: [70, 1], resilience: [65, 1], shelf: [30, 1] });

  test("each part with evidence on both sides reports its change in points", () => {
    const c = compareWithEarlier(now, before);
    expect(comp(c, "exposure").vsBefore).toEqual({ window: "4 weeks", change: 10 });
    expect(comp(c, "resilience").vsBefore).toEqual({ window: "4 weeks", change: -5 });
  });

  test("a part that was barely seen on either side reports no change rather than an artefact", () => {
    const c = compareWithEarlier(now, before);
    expect(comp(c, "shelf").vsBefore).toBeNull(); // 0.2 confidence now
    expect(comp(c, "validation").vsBefore).toBeNull(); // nothing either time
  });

  test("the whole is compared only when both pictures were complete enough to trust", () => {
    expect(compareWithEarlier(now, before).vsBefore?.change).toBe(now.overall - before.overall);
    expect(compareWithEarlier(now, score({})).vsBefore).toBeNull();
  });
});

describe("when there is no number to show", () => {
  test("a handful of first entries adds up to a confident-looking figure, so below a fifth of the picture the number is withheld", () => {
    const four = score({ exposure: [63, 0.03], resilience: [100, 0.07], validation: [100, 0.5], shelf: [90, 0.17] });
    expect(four.overall).toBeGreaterThan(80); // what a first day looks like: high, and meaning very little
    expect(four.coverage).toBeLessThan(NUMBER_MIN_COVERAGE);
    expect(showsNumber(four)).toBe(false);
    expect(four.provisional).toBe(true);
  });

  test("once a fifth of the picture is filled in, the number is shown (still marked early until it is trusted)", () => {
    const some = score({ exposure: [70, 0.6], resilience: [80, 0.5] });
    expect(showsNumber(some)).toBe(true);
    expect(NUMBER_MIN_COVERAGE).toBeLessThan(PROVISIONAL_COVERAGE);
  });
});
