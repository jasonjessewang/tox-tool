/**
 * Weekly digest: same "indicator" concept as the existing awareness band (reused directly,
 * not a second scoring system), plus three forward-looking sections -- what to consider
 * adding (never subtracted from the score, same "adding good" framing as onboarding), one
 * rotating toxicology education topic tied to what's actually been logged, and a
 * self-assessment cadence reminder (quarterly by default, matching common lab-panel/biomarker
 * testing cycles). Pure and synchronous like scoring.ts -- no I/O, fully testable.
 */
import { ADDING_GOOD_PRACTICE_TYPES, PRACTICE_LABELS, loadConcepts } from "./scoring";
import type { ScoreReport, Substance, BiomarkerLog, PracticeType, AwarenessBand, Concept } from "./types";
import { daysBetweenISO, todayISO } from "../util/dates";

export interface EducationTopic {
  conceptId: string;
  title: string;
  text: string;
}

export interface SelfAssessmentStatus {
  daysSinceLastBiomarker: number | null;
  dueForCheckIn: boolean;
  message: string;
}

export interface WeeklyDigest {
  indicator: AwarenessBand;
  healthyBehaviorsToConsider: { practiceType: PracticeType; label: string }[];
  educationTopic: EducationTopic;
  selfAssessment: SelfAssessmentStatus;
}

export const SELF_ASSESSMENT_CADENCE_DAYS = 90; // quarterly -- the tighter of the "quarterly/biannual" range this feature targets

// Used only when nothing's been logged/flagged this week to draw a topic from --
// deterministic per ISO week so it's stable within a week, not random on every screen visit.
const FALLBACK_CONCEPT_ROTATION = [
  "dose_response",
  "aggregate_exposure",
  "bioaccumulation_half_life",
  "hepatic_metabolism",
  "renal_clearance",
  "particle_deposition",
  "endocrine_disruption",
  "nova_classification",
];

export function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function topConceptTag(report: ScoreReport, substancesById: Record<string, Substance>): string | null {
  const tagCounts: Record<string, number> = {};
  for (const summary of Object.values(report.category_summary)) {
    if (!summary) continue;
    for (const hit of summary.substances) {
      const substance = substancesById[hit.id];
      for (const tag of substance?.concept_tags ?? []) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + hit.count;
      }
    }
  }
  const ranked = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  return ranked.length > 0 ? ranked[0][0] : null;
}

function pickEducationTopic(report: ScoreReport, substancesById: Record<string, Substance>, now: Date): EducationTopic {
  const concepts = loadConcepts();
  const tag = topConceptTag(report, substancesById) ?? FALLBACK_CONCEPT_ROTATION[isoWeekNumber(now) % FALLBACK_CONCEPT_ROTATION.length];
  const concept: Concept = concepts[tag] ?? concepts[FALLBACK_CONCEPT_ROTATION[0]];
  return { conceptId: concept.id, title: concept.name, text: concept.general };
}

function daysBetween(fromDate: string, now: Date): number {
  return daysBetweenISO(fromDate, todayISO(now));
}

function buildSelfAssessment(recentBiomarkers: BiomarkerLog[], now: Date): SelfAssessmentStatus {
  const lastDate = recentBiomarkers.length > 0 ? [...recentBiomarkers].map((b) => b.log_date).sort().reverse()[0] : null;
  const daysSinceLastBiomarker = lastDate ? daysBetween(lastDate, now) : null;
  const dueForCheckIn = daysSinceLastBiomarker === null || daysSinceLastBiomarker >= SELF_ASSESSMENT_CADENCE_DAYS;

  let message: string;
  if (daysSinceLastBiomarker === null) {
    message =
      "No biomarkers logged yet. A quarterly or twice-a-year check-in -- resting heart rate, a basic metabolic " +
      "panel, whatever's accessible to you -- gives your own body data to validate against, not just logged habits.";
  } else if (dueForCheckIn) {
    message = `It's been ${daysSinceLastBiomarker} days since your last biomarker log -- worth considering a check-in if you're due for quarterly or biannual testing.`;
  } else {
    message = `Last biomarker logged ${daysSinceLastBiomarker} day${daysSinceLastBiomarker === 1 ? "" : "s"} ago -- you're within a typical quarterly window.`;
  }

  return { daysSinceLastBiomarker, dueForCheckIn, message };
}

export function buildWeeklyDigest(
  report: ScoreReport,
  substancesById: Record<string, Substance>,
  recentBiomarkers: BiomarkerLog[],
  now: Date = new Date()
): WeeklyDigest {
  const loggedTypes = new Set(Object.keys(report.practice_summary));
  const healthyBehaviorsToConsider = ADDING_GOOD_PRACTICE_TYPES.filter((pt) => !loggedTypes.has(pt)).map((pt) => ({
    practiceType: pt,
    label: PRACTICE_LABELS[pt],
  }));

  return {
    indicator: report.awareness_band,
    healthyBehaviorsToConsider,
    educationTopic: pickEducationTopic(report, substancesById, now),
    selfAssessment: buildSelfAssessment(recentBiomarkers, now),
  };
}
