import { buildWeeklyDigest, isoWeekNumber, SELF_ASSESSMENT_CADENCE_DAYS } from "./weeklyDigest";
import { loadHazardDb, scoreLogs } from "./scoring";
import type { LogStore, BiomarkerLog } from "./types";
import { daysAgoISO } from "../util/dates";

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
