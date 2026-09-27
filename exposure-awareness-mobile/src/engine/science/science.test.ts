import { computeRisk, translate, questionsForCareTeam, formatPerThousand } from "./riskMath";
import { curve, response, marginOfExposure } from "./doseResponse";
import { deriveRfD } from "./thresholds";
import { ILLUSTRATIVE_STRATA, crudeRR, adjustedRR, stratumRR } from "./confounding";
import { computeEngineHealth } from "./engineHealth";

describe("risk math", () => {
  test("10x of a 1-in-10,000 risk is 1-in-1,000: 0.9 extra per 1,000", () => {
    const r = computeRisk({ oneIn: 10000, relativeRisk: 10 });
    expect(r.perThousandBaseline).toBeCloseTo(0.1);
    expect(r.perThousandExposed).toBeCloseTo(1);
    expect(r.perThousandExtra).toBeCloseTo(0.9);
    expect(r.percentIncrease).toBe(900);
    expect(r.numberNeededToHarm).toBe(1111);
  });

  test("the same relative risk has a far bigger absolute effect at a higher baseline", () => {
    const rare = computeRisk({ oneIn: 10000, relativeRisk: 2 });
    const common = computeRisk({ oneIn: 10, relativeRisk: 2 });
    expect(common.absoluteIncrease / rare.absoluteIncrease).toBeCloseTo(1000, 0);
  });

  test("absolute increase equals baseline x (RR - 1); RR of 1 means no change", () => {
    const r = computeRisk({ oneIn: 100, relativeRisk: 1.5 });
    expect(r.absoluteIncrease).toBeCloseTo(0.01 * 0.5);
    expect(computeRisk({ oneIn: 100, relativeRisk: 1 }).numberNeededToHarm).toBe(null);
  });

  test("risk can never exceed 100%", () => {
    const r = computeRisk({ oneIn: 2, relativeRisk: 10 });
    expect(r.exposed).toBe(1);
    expect(r.capped).toBe(true);
  });

  test("translation and clinician questions use the user's own numbers", () => {
    const t = translate({ oneIn: 10000, relativeRisk: 10 });
    expect(t.headline).toContain("900%");
    expect(t.honest).toContain("1 in 10,000");
    expect(t.honest).toContain("1 in 1,000");
    expect(questionsForCareTeam({ oneIn: 1000, relativeRisk: 2 }).join(" ")).toContain("1 in 1,000");
    expect(formatPerThousand(0.004)).toBe("<0.01");
  });
});

describe("dose-response", () => {
  test("threshold model is exactly zero at or below the NOAEL and rises above it", () => {
    expect(response("threshold", 0.5)).toBe(0);
    expect(response("threshold", 1)).toBe(0);
    expect(response("threshold", 10)).toBeGreaterThan(response("threshold", 2));
  });

  test("linear model has no threshold: any dose produces some response", () => {
    expect(response("linear", 0.01)).toBeGreaterThan(0);
    expect(response("linear", 50)).toBeGreaterThan(response("linear", 5));
  });

  test("non-monotonic model: a low dose responds more than a mid dose, and the high dose responds most", () => {
    expect(response("nonmonotonic", 0.1)).toBeGreaterThan(response("nonmonotonic", 1));
    expect(response("nonmonotonic", 100)).toBeGreaterThan(response("nonmonotonic", 0.1));
  });

  test("curves are bounded 0..1 and margin of exposure divides NOAEL by exposure", () => {
    for (const m of ["threshold", "linear", "nonmonotonic"] as const) {
      for (const p of curve(m)) expect(p.response).toBeGreaterThanOrEqual(0), expect(p.response).toBeLessThanOrEqual(1);
    }
    expect(marginOfExposure(50, 0.05)).toBe(1000);
  });
});

describe("safety thresholds", () => {
  test("default recipe divides by 10 x 10", () => {
    expect(deriveRfD({ noael: 50 })).toEqual({ rfd: 0.5, totalFactor: 100 });
  });
  test("extra factors multiply in, and factors below 1 are ignored", () => {
    expect(deriveRfD({ noael: 50, extra: [10, 3] }).totalFactor).toBe(3000);
    expect(deriveRfD({ noael: 50, interspecies: 0.1 }).totalFactor).toBe(10);
  });
});

describe("confounding lab", () => {
  test("crude association is large but vanishes once smoking is accounted for", () => {
    expect(crudeRR(ILLUSTRATIVE_STRATA)).toBeGreaterThan(2.5);
    expect(adjustedRR(ILLUSTRATIVE_STRATA)).toBeCloseTo(1, 5);
    for (const s of ILLUSTRATIVE_STRATA) expect(stratumRR(s)).toBeCloseTo(1, 5);
  });
});

describe("engine health", () => {
  const empty = { daysLoggedThisWeek: 0, inputTypesThisWeek: 0, daysSinceBiomarker: null, learningDaysLast7: 0, profileFieldsFilled: 0, evidenceItems: 0, evidenceNewestYear: null };
  test("an empty engine is warming up; a fully fed one is strong", () => {
    expect(computeEngineHealth(empty).label).toBe("Warming up");
    const full = computeEngineHealth({ daysLoggedThisWeek: 5, inputTypesThisWeek: 5, daysSinceBiomarker: 30, learningDaysLast7: 3, profileFieldsFilled: 4, evidenceItems: 15, evidenceNewestYear: new Date().getFullYear() });
    expect(full.label).toBe("Strong");
    expect(full.overall).toBeGreaterThanOrEqual(90);
  });
  test("every component says how to improve, and stale biomarkers score lower than fresh ones", () => {
    const base = { ...empty, evidenceItems: 15, evidenceNewestYear: 2024 };
    const fresh = computeEngineHealth({ ...base, daysSinceBiomarker: 10 }).components.find((c) => c.key === "validation")!;
    const stale = computeEngineHealth({ ...base, daysSinceBiomarker: 200 }).components.find((c) => c.key === "validation")!;
    expect(fresh.score).toBeGreaterThan(stale.score);
    for (const c of computeEngineHealth(base).components) expect(c.improve.length).toBeGreaterThan(10);
  });
});
