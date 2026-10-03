import { buildWeeklyDigest, isoWeekNumber, SELF_ASSESSMENT_CADENCE_DAYS } from "./weeklyDigest";
import { loadConcepts, loadHazardDb, scoreLogs } from "./scoring";
import type { LogStore, BiomarkerLog, StandingExposure, UserProfile, Condition } from "./types";
import { daysAgoISO } from "../util/dates";
import { Rng } from "../sim/rng";

const substances = loadHazardDb();
const byId = Object.fromEntries(substances.map((s) => [s.id, s]));

const EMPTY_LOGS: LogStore = { food: [], products: [], environment: [], air_quality: [], practices: [] };

function biomarker(daysAgo: number, now: Date): BiomarkerLog {
  return {
    id: "b1",
    log_date: daysAgoISO(daysAgo, now),
    metric: "Resting heart rate",
    value: 60,
    unit: "bpm",
    source: "",
    notes: "",
    created_at: "",
  };
}

test("indicator is the same awareness_band object the score report already computed -- no second scoring system", () => {
  const report = scoreLogs(EMPTY_LOGS);
  const digest = buildWeeklyDigest(report, byId, []);
  expect(digest.indicator).toEqual(report.awareness_band);
});

test("with nothing logged, all adding-good practice types are suggested", () => {
  const report = scoreLogs(EMPTY_LOGS);
  const digest = buildWeeklyDigest(report, byId, []);
  const types = digest.healthyBehaviorsToConsider.map((b) => b.practiceType);
  expect(types).toContain("sleep");
  expect(types).toContain("hydration");
  expect(types).toContain("exercise");
  expect(types).toContain("grounding_stretching");
});

test("a logged practice type drops out of the suggestion list", () => {
  const logs: LogStore = {
    ...EMPTY_LOGS,
    practices: [{ id: "p1", log_date: "2026-01-01", practice_type: "sleep", duration_minutes: 420, detail: "", notes: "", created_at: "" }],
  };
  const report = scoreLogs(logs);
  const digest = buildWeeklyDigest(report, byId, []);
  const types = digest.healthyBehaviorsToConsider.map((b) => b.practiceType);
  expect(types).not.toContain("sleep");
  expect(types).toContain("hydration");
});

test("education topic is drawn from a concept tag actually present on a flagged substance this week", () => {
  const logs: LogStore = {
    ...EMPTY_LOGS,
    food: [{ id: "f1", log_date: "2026-01-01", meal: "lunch", food_item: "canned soup with BPA lining", processing_level: null, notes: "", created_at: "" }],
  };
  const report = scoreLogs(logs);
  const bpa = byId["bpa"];
  const digest = buildWeeklyDigest(report, byId, []);
  expect(bpa.concept_tags).toContain(digest.educationTopic.conceptId);
});

test("education topic falls back to the deterministic weekly rotation when nothing is flagged", () => {
  const report = scoreLogs(EMPTY_LOGS);
  const now = new Date(2026, 2, 10, 12);
  const digest = buildWeeklyDigest(report, byId, [], now);
  // Same input, same week -> same topic (deterministic, not random per render)
  const digest2 = buildWeeklyDigest(report, byId, [], now);
  expect(digest.educationTopic.conceptId).toBe(digest2.educationTopic.conceptId);
});

test("isoWeekNumber is stable within a week and advances across week boundaries", () => {
  const mon = isoWeekNumber(new Date(2026, 2, 9, 12));
  const fri = isoWeekNumber(new Date(2026, 2, 13, 12));
  const nextMon = isoWeekNumber(new Date(2026, 2, 16, 12));
  expect(fri).toBe(mon);
  expect(nextMon).toBe(mon + 1);
});

test("self-assessment: no biomarkers ever logged is treated as due, not silently ignored", () => {
  const report = scoreLogs(EMPTY_LOGS);
  const digest = buildWeeklyDigest(report, byId, []);
  expect(digest.selfAssessment.daysSinceLastBiomarker).toBe(null);
  expect(digest.selfAssessment.dueForCheckIn).toBe(true);
  expect(digest.selfAssessment.message).toContain("No biomarkers logged");
});

test("self-assessment: a recent biomarker (well under the quarterly cadence) is not due", () => {
  const now = new Date(2026, 5, 1, 12);
  const report = scoreLogs(EMPTY_LOGS);
  const digest = buildWeeklyDigest(report, byId, [biomarker(10, now)], now);
  expect(digest.selfAssessment.daysSinceLastBiomarker).toBe(10);
  expect(digest.selfAssessment.dueForCheckIn).toBe(false);
});

test("self-assessment: a biomarker older than the quarterly cadence is due again", () => {
  const now = new Date(2026, 5, 1, 12);
  const report = scoreLogs(EMPTY_LOGS);
  const digest = buildWeeklyDigest(report, byId, [biomarker(SELF_ASSESSMENT_CADENCE_DAYS + 5, now)], now);
  expect(digest.selfAssessment.dueForCheckIn).toBe(true);
});

test("self-assessment uses the most recent of several logged biomarkers, not the oldest", () => {
  const now = new Date(2026, 5, 1, 12);
  const report = scoreLogs(EMPTY_LOGS);
  const digest = buildWeeklyDigest(report, byId, [biomarker(100, now), biomarker(5, now)], now);
  expect(digest.selfAssessment.daysSinceLastBiomarker).toBe(5);
});

// ---------- tailored to the person: the shelf, the places, and the profile --------------------------------------------

const shelf = (substanceId: string, weight: number, product = "Shampoo"): StandingExposure => ({ substanceId, weight, via: [product], origin: "shelf" });
const place = (substanceId: string, weight: number, where = "Home: gas cooking"): StandingExposure => ({ substanceId, weight, via: [], viaPlaces: [where], origin: "places" });

function person(p: Partial<UserProfile> = {}): UserProfile {
  return {
    ageYears: 40, sex: "female", weightKg: 65, heightCm: 165, pregnant: false, breastfeeding: false, conditions: [],
    contentComplexity: "balanced", completedAt: "2026-01-01T00:00:00.000Z", locationEnabled: false, checkInTime: "off", ...p,
  };
}

const MID_WEEK = new Date(2026, 2, 11, 12);

describe("the topic comes from what the person lives with, not only this week's log", () => {
  test("with nothing logged, the shelf alone picks the topic, and the digest says where it came from", () => {
    const digest = buildWeeklyDigest(scoreLogs(EMPTY_LOGS), byId, [], MID_WEEK, { standing: [shelf("phthalates", 6)] });
    expect(byId["phthalates"].concept_tags).toContain(digest.educationTopic.conceptId);
    expect(digest.educationTopic.why).toBe("From your shelf: Phthalates.");
  });

  test("a place answer names the places as the source, and radon's two distinctive ideas take turns week to week", () => {
    const topics = new Set<string>();
    for (let w = 0; w < 6; w++) {
      const digest = buildWeeklyDigest(scoreLogs(EMPTY_LOGS), byId, [], new Date(2026, 2, 2 + w * 7, 12), { standing: [place("radon", 4.5, "Home: radon")] });
      expect(digest.educationTopic.why).toBe("From your places: Radon gas.");
      topics.add(digest.educationTopic.conceptId);
    }
    expect([...topics].sort()).toEqual(["alpha_radiation", "carcinogen_classification"]);
  });

  test("dose-response (on 33 of 41 substances) gives way to the more distinctive idea when one is present", () => {
    for (const id of ["phthalates", "lead_exposure", "radon", "pm25_particulate", "alcohol"]) {
      const digest = buildWeeklyDigest(scoreLogs(EMPTY_LOGS), byId, [], MID_WEEK, { standing: [shelf(id, 5)] });
      expect({ id, topic: digest.educationTopic.conceptId }).not.toEqual({ id, topic: "dose_response" });
    }
  });

  test("with nothing logged, shelved or answered, the topic comes from the rotating list and says so", () => {
    const digest = buildWeeklyDigest(scoreLogs(EMPTY_LOGS), byId, [], MID_WEEK, { profile: person({ pregnant: true }) });
    expect(digest.educationTopic.why).toContain("rotating list");
    expect(digest.educationTopic.personal).toEqual([]);
    expect(digest.mattersMoreForYou).toEqual([]);
  });

  test("the topic is always a concept the app can teach, with both a plain and a technical text", () => {
    const concepts = loadConcepts();
    const rng = new Rng(11);
    for (let i = 0; i < 200; i++) {
      const standing = Array.from({ length: rng.int(0, 6) }, () => shelf(rng.pick(substances).id, rng.range(0.2, 15)));
      const t = buildWeeklyDigest(scoreLogs(EMPTY_LOGS), byId, [], new Date(2026, 0, 5 + i * 7, 12), { standing }).educationTopic;
      expect(concepts[t.conceptId]).toBeDefined();
      expect(t.text.length).toBeGreaterThan(20);
      expect(t.technical.length).toBeGreaterThan(20);
    }
  });
});

describe("what matters more for this person is taught first and listed", () => {
  test("pregnancy with phthalates on the shelf teaches endocrine disruption, and says why it matters more", () => {
    const digest = buildWeeklyDigest(scoreLogs(EMPTY_LOGS), byId, [], MID_WEEK, { profile: person({ pregnant: true }), standing: [shelf("phthalates", 6)] });
    expect(digest.educationTopic.conceptId).toBe("endocrine_disruption");
    expect(digest.educationTopic.personal.map((r) => r.label)).toEqual(["Pregnancy"]);
    expect(digest.mattersMoreForYou.map((m) => m.substanceId)).toEqual(["phthalates"]);
  });

  test("the same shelf without a profile is not personalized", () => {
    const digest = buildWeeklyDigest(scoreLogs(EMPTY_LOGS), byId, [], MID_WEEK, { standing: [shelf("phthalates", 6)] });
    expect(digest.educationTopic.personal).toEqual([]);
    expect(digest.mattersMoreForYou).toEqual([]);
  });

  test("a kidney condition with lead from an older home teaches renal clearance", () => {
    const digest = buildWeeklyDigest(scoreLogs(EMPTY_LOGS), byId, [], MID_WEEK, { profile: person({ conditions: ["kidney"] }), standing: [place("lead_exposure", 6, "Home: built before 1978")] });
    expect(digest.educationTopic.conceptId).toBe("renal_clearance");
    expect(digest.educationTopic.personal.map((r) => r.label)).toEqual(["Kidney condition"]);
    expect(digest.mattersMoreForYou[0]).toMatchObject({ substanceId: "lead_exposure", from: ["places"] });
  });

  test("a personally relevant tag is taught even when a heavier, unrelated one is present", () => {
    const digest = buildWeeklyDigest(scoreLogs(EMPTY_LOGS), byId, [], MID_WEEK, {
      profile: person({ conditions: ["asthma"] }),
      standing: [place("candle_incense_pm", 1, "Home: candles"), shelf("formaldehyde_releasers", 14)],
    });
    expect(digest.educationTopic.conceptId).toBe("particle_deposition");
  });

  test("over the weeks, a person with several personal relevances is taught each of them, not the same one forever", () => {
    const profile = person({ pregnant: true, conditions: ["asthma"] });
    const standing = [shelf("phthalates", 8), shelf("pfas_packaging", 6, "Takeout box"), place("candle_incense_pm", 4, "Home: candles")];
    const topics = new Set<string>();
    for (let w = 0; w < 12; w++) topics.add(buildWeeklyDigest(scoreLogs(EMPTY_LOGS), byId, [], new Date(2026, 0, 5 + w * 7, 12), { profile, standing }).educationTopic.conceptId);
    expect(topics.size).toBeGreaterThanOrEqual(2);
    for (const t of topics) expect(["endocrine_disruption", "bioaccumulation_half_life", "particle_deposition"]).toContain(t);
  });

  test("the topic is stable within a week (same inputs, any day Mon-Sun)", () => {
    const ctx = { profile: person({ pregnant: true, conditions: ["asthma"] }), standing: [shelf("phthalates", 8), place("candle_incense_pm", 6)] };
    const days = [9, 10, 11, 12, 13, 14, 15].map((d) => buildWeeklyDigest(scoreLogs(EMPTY_LOGS), byId, [], new Date(2026, 2, d, 12), ctx).educationTopic.conceptId);
    expect(new Set(days).size).toBe(1);
  });

  test("the list of what matters more is heaviest first, at most four, and says where each comes from", () => {
    const digest = buildWeeklyDigest(scoreLogs(EMPTY_LOGS), byId, [], MID_WEEK, {
      profile: person({ pregnant: true }),
      standing: [shelf("parabens", 2), shelf("phthalates", 9), shelf("bpa", 4, "Canned soup"), shelf("bisphenol_analogs", 3, "Receipt"), shelf("lead_exposure", 1), place("phthalates", 1, "Home: fragrance")],
    });
    expect(digest.mattersMoreForYou).toHaveLength(4);
    expect(digest.mattersMoreForYou[0]).toMatchObject({ substanceId: "phthalates", from: ["shelf", "places"] });
    expect(digest.mattersMoreForYou.every((m) => m.reasons.length > 0)).toBe(true);
  });

  test("something logged this week counts alongside the shelf, and is named as the log", () => {
    const logs: LogStore = {
      ...EMPTY_LOGS,
      food: [{ id: "f1", log_date: "2026-03-10", meal: "lunch", food_item: "canned soup with BPA lining", processing_level: null, notes: "", created_at: "" }],
    };
    const digest = buildWeeklyDigest(scoreLogs(logs), byId, [], MID_WEEK, { profile: person({ pregnant: true }) });
    expect(digest.mattersMoreForYou[0]).toMatchObject({ substanceId: "bpa", from: ["log"] });
    expect(digest.educationTopic.why).toContain("this week's log");
  });
});

test("the digest's own wording stays calm for any mix of log, shelf, places and profile (randomized)", () => {
  const forbidden = ["risk", "danger", "dangerous", "toxic", "unsafe", "bad", "fail", "worse", "poor", "alarm"];
  const conditions: Condition[] = ["asthma", "kidney", "liver", "immunocompromised", "fragrance_sensitivity"];
  const rng = new Rng(2026);
  for (let i = 0; i < 300; i++) {
    const profile = person({
      ageYears: rng.pick([3, 15, 30, 70]),
      pregnant: rng.chance(0.3),
      breastfeeding: rng.chance(0.2),
      conditions: conditions.filter(() => rng.chance(0.3)),
    });
    const standing = Array.from({ length: rng.int(0, 7) }, () => (rng.chance(0.5) ? shelf(rng.pick(substances).id, rng.range(0.2, 15)) : place(rng.pick(substances).id, rng.range(0.2, 8))));
    const digest = buildWeeklyDigest(scoreLogs(EMPTY_LOGS), byId, [], new Date(2026, 0, 5 + i, 12), { profile, standing });
    const text = [
      digest.educationTopic.why,
      digest.selfAssessment.message,
      ...digest.healthyBehaviorsToConsider.map((b) => b.label),
      ...digest.mattersMoreForYou.flatMap((m) => m.reasons.flatMap((r) => [r.label, r.reason])),
      ...digest.educationTopic.personal.flatMap((r) => [r.label, r.reason]),
    ].join(" ").toLowerCase();
    for (const word of forbidden) expect({ i, word, found: new RegExp(`\\b${word}\\b`).test(text) }).toEqual({ i, word, found: false });
  }
});
