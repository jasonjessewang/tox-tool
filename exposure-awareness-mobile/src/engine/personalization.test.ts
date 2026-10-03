import { computeLifeStage, getPersonalReasons, personalRelevance, weightedExposure, bodyWeightContextNote } from "./personalization";
import { loadHazardDb, scoreLogs } from "./scoring";
import type { UserProfile, LogStore } from "./types";

const substances = loadHazardDb();
const byId = Object.fromEntries(substances.map((s) => [s.id, s]));

function baseProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    ageYears: 30,
    sex: "unspecified",
    weightKg: 70,
    heightCm: 170,
    pregnant: false,
    breastfeeding: false,
    conditions: [],
    contentComplexity: "balanced",
    completedAt: "2026-01-01T00:00:00.000Z",
    locationEnabled: false,
    checkInTime: "off",
    ...overrides,
  };
}

test("life stage buckets match the documented age ranges", () => {
  expect(computeLifeStage(5)).toBe("child");
  expect(computeLifeStage(11)).toBe("child");
  expect(computeLifeStage(12)).toBe("adolescent");
  expect(computeLifeStage(17)).toBe("adolescent");
  expect(computeLifeStage(18)).toBe("adult");
  expect(computeLifeStage(64)).toBe("adult");
  expect(computeLifeStage(65)).toBe("older_adult");
  expect(computeLifeStage(null)).toBe(null);
});

test("kidney condition flags a substance tagged renal_clearance (lead) with a real reason", () => {
  const lead = byId["lead_exposure"];
  expect(lead.concept_tags).toContain("renal_clearance");
  const reasons = getPersonalReasons(lead, baseProfile({ conditions: ["kidney"] }));
  expect(reasons.some((r) => r.label === "Kidney condition")).toBe(true);
});

test("kidney condition does NOT flag a substance with no renal_clearance tag", () => {
  const dyes = byId["artificial_food_dyes"];
  expect(dyes.concept_tags).not.toContain("renal_clearance");
  const reasons = getPersonalReasons(dyes, baseProfile({ conditions: ["kidney"] }));
  expect(reasons.length).toBe(0);
});

test("pregnancy flags BPA (endocrine_disruption) with a pregnancy-specific reason", () => {
  const bpa = byId["bpa"];
  expect(bpa.concept_tags).toContain("endocrine_disruption");
  const reasons = getPersonalReasons(bpa, baseProfile({ pregnant: true }));
  expect(reasons.some((r) => r.label === "Pregnancy" && r.conceptTag === "endocrine_disruption")).toBe(true);
});

test("child life stage flags dose_response and endocrine_disruption tagged substances", () => {
  const bpa = byId["bpa"];
  const reasons = getPersonalReasons(bpa, baseProfile({ ageYears: 8 }));
  expect(reasons.some((r) => r.label === "Child")).toBe(true);
});

test("older adult flags renal/hepatic clearance substances", () => {
  const lead = byId["lead_exposure"];
  const reasons = getPersonalReasons(lead, baseProfile({ ageYears: 70 }));
  expect(reasons.some((r) => r.label === "Age 65+" && r.conceptTag === "renal_clearance")).toBe(true);
});

test("fragrance sensitivity flags phthalates via direct substance match, not a concept tag", () => {
  const phthalates = byId["phthalates"];
  const reasons = getPersonalReasons(phthalates, baseProfile({ conditions: ["fragrance_sensitivity"] }));
  expect(reasons.some((r) => r.label === "Fragrance/chemical sensitivity")).toBe(true);
});

test("no reasons fire for a plain adult with no conditions/pregnancy", () => {
  const bpa = byId["bpa"];
  const reasons = getPersonalReasons(bpa, baseProfile());
  expect(reasons.length).toBe(0);
});

test("reasons are de-duplicated -- kidney AND age 65+ both hitting renal_clearance stays two distinct entries, never literal duplicates", () => {
  const lead = byId["lead_exposure"];
  const reasons = getPersonalReasons(lead, baseProfile({ ageYears: 70, conditions: ["kidney"] }));
  const renalReasons = reasons.filter((r) => r.conceptTag === "renal_clearance");
  expect(renalReasons.length).toBe(2); // "Kidney condition" + "Age 65+" -- distinct causes
  const labels = renalReasons.map((r) => r.label);
  expect(new Set(labels).size).toBe(2);
});

const BPA_LOG: LogStore = {
  food: [{ id: "1", log_date: "2026-01-01", meal: "breakfast", food_item: "canned juice with BPA-lined packaging", processing_level: null, notes: "", created_at: "" }],
  products: [], environment: [], air_quality: [], practices: [],
};

test("with no profile nothing is personalized", () => {
  const weighted = weightedExposure(scoreLogs(BPA_LOG), [{ substanceId: "phthalates", weight: 5, via: ["Shampoo"] }]);
  expect(personalRelevance(weighted, null, byId)).toEqual([]);
});

test("personal relevance covers this week's log and what the shelf and places carry, heaviest first, and never touches the score", () => {
  const report = scoreLogs(BPA_LOG);
  const before = report.overall_score;
  const weighted = weightedExposure(report, [
    { substanceId: "phthalates", weight: 5, via: ["Shampoo"] },
    { substanceId: "lead_exposure", weight: 2, via: [], viaPlaces: ["Home: built before 1978"], origin: "places" },
    { substanceId: "phthalates", weight: 1, via: [], viaPlaces: ["Home: fragrance"], origin: "places" },
  ]);
  const personal = personalRelevance(weighted, baseProfile({ pregnant: true }), byId);
  expect(personal.map((p) => [p.substanceId, p.from])).toEqual([
    ["phthalates", ["shelf", "places"]],
    ["lead_exposure", ["places"]],
    ["bpa", ["log"]],
  ]);
  expect(personal.every((p) => p.reasons.some((r) => r.label === "Pregnancy"))).toBe(true);
  expect(report.overall_score).toBe(before);
});

test("bodyWeightContextNote is educational, not a dose calculation, and never fabricates a number without weight", () => {
  expect(bodyWeightContextNote(null)).toBe(null);
  expect(bodyWeightContextNote(45)).toContain("smaller-bodied");
  expect(bodyWeightContextNote(70)).not.toContain("smaller-bodied");
  expect(bodyWeightContextNote(70)).not.toContain("larger-bodied");
  expect(bodyWeightContextNote(100)).toContain("larger-bodied");
});
