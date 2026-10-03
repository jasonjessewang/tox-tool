/**
 * "What healthy running looks like": how much the engine has to work with, not a judgement
 * of the person. Six components, each 0..1, each with a concrete way to improve it.
 */
import { msg, tr, trn } from "../../i18n";
export interface EngineHealthInput {
  daysLoggedThisWeek: number;
  inputTypesThisWeek: number; // of 5: food, products, environment, air, practices
  daysSinceBiomarker: number | null;
  learningDaysLast7: number;
  profileFieldsFilled: number; // of 4: age, sex, weight, conditions answered
  evidenceItems: number;
  evidenceNewestYear: number | null;
}

export interface EngineComponent {
  key: string;
  label: string;
  score: number;
  detail: string;
  improve: string;
}

export interface EngineHealth {
  overall: number;
  label: "Warming up" | "Running well" | "Strong";
  components: EngineComponent[];
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** Shared with wellnessScore.ts: 0-100 freshness of the most recent biomarker, on a
 * quarterly cadence. null (never logged) is 0, not a fake neutral -- consistent with how
 * every other "haven't started yet" state in this app is scored. */
export function biomarkerFreshnessScore(daysSinceLastBiomarker: number | null): number {
  if (daysSinceLastBiomarker === null) return 0;
  if (daysSinceLastBiomarker <= 90) return 100;
  if (daysSinceLastBiomarker <= 180) return 50;
  return 20;
}

export function computeEngineHealth(i: EngineHealthInput, now: Date = new Date()): EngineHealth {
  const evidenceAge = i.evidenceNewestYear === null ? null : now.getFullYear() - i.evidenceNewestYear;
  const biomarker = biomarkerFreshnessScore(i.daysSinceBiomarker) / 100;

  const components: EngineComponent[] = [
    { key: "freshness", label: msg("Fresh inputs"), score: clamp(i.daysLoggedThisWeek / 4), detail: tr("{n} of the last 7 days have entries.", { n: i.daysLoggedThisWeek }), improve: msg("Log something on 4 of 7 days -- a meal, a reset, anything.") },
    { key: "breadth", label: msg("Breadth"), score: clamp(i.inputTypesThisWeek / 4), detail: tr("{n} of 5 input types used this week.", { n: i.inputTypesThisWeek }), improve: msg("Add a different kind of input: scan a product, log air quality, add sleep.") },
    { key: "validation", label: msg("Checked against your body"), score: biomarker, detail: i.daysSinceBiomarker === null ? tr("No biomarker yet.") : trn(i.daysSinceBiomarker, "Last biomarker {n} day ago.", "Last biomarker {n} days ago."), improve: msg("Log a lab value or wearable reading at least every 3 months.") },
    { key: "fit", label: msg("Personal fit"), score: clamp(i.profileFieldsFilled / 4), detail: tr("{n} of 4 profile details filled in.", { n: i.profileFieldsFilled }), improve: msg("Add age, sex, weight and health conditions so relevance is tailored.") },
    { key: "learning", label: msg("Your understanding"), score: clamp(i.learningDaysLast7 / 3), detail: tr("Learned on {n} of the last 7 days.", { n: i.learningDaysLast7 }), improve: msg("Read one lesson or research summary on 3 days a week.") },
    { key: "evidence", label: msg("Evidence currency"), score: i.evidenceItems === 0 ? 0 : clamp(1 - (evidenceAge ?? 5) / 15), detail: tr("{n} evidence items; newest from {year}.", { n: i.evidenceItems, year: i.evidenceNewestYear ?? tr("n/a") }), improve: msg("Library refreshes from PubMed; new summaries appear after review.") },
  ];

  const overall = Math.round((components.reduce((s, c) => s + c.score, 0) / components.length) * 100);
  return { overall, label: overall >= 75 ? msg("Strong") : overall >= 40 ? msg("Running well") : msg("Warming up"), components };
}
