/**
 * Weekly digest: same "indicator" concept as the existing awareness band (reused directly,
 * not a second scoring system), plus forward-looking sections -- what to consider
 * adding (never subtracted from the score, same "adding good" framing as onboarding), one
 * rotating toxicology education topic tied to what the person logs and lives with, what in
 * that matters more for them specifically, and a self-assessment cadence reminder (quarterly
 * by default, matching common lab-panel/biomarker testing cycles). Pure and synchronous like
 * scoring.ts -- no I/O, fully testable.
 */
import { ADDING_GOOD_PRACTICE_TYPES, PRACTICE_LABELS, loadConcepts } from "./scoring";
import { personalRelevance, weightedExposure, type ExposureSource, type WeightedSubstance } from "./personalization";
import type { ScoreReport, Substance, BiomarkerLog, PracticeType, AwarenessBand, Concept, PersonalReason, StandingExposure, UserProfile } from "./types";
import { daysBetweenISO, todayISO } from "../util/dates";
import { listWords, msg, tr, trn } from "../i18n";

export interface EducationTopic {
  conceptId: string;
  title: string;
  /** plain-language text, for every reader */
  text: string;
  /** the mechanism, for someone who asked for the technical level (or opens "Go deeper") */
  technical: string;
  /** where the topic comes from, in plain words -- never left for the reader to guess */
  why: string;
  /** when the person's profile makes this topic matter more for them: which factor, and why */
  personal: PersonalReason[];
}

/** Context beyond this week's logs. Both are optional: without them the digest still works, just less tailored. */
export interface DigestContext {
  /** concept tags that matter more for this person are taught first (engine/personalization.ts) */
  profile?: UserProfile | null;
  /** what the shelf and places carry week after week (engine/adviceState.ts) -- most of what a person actually lives with */
  standing?: StandingExposure[];
}

export interface PersonalItem {
  substanceId: string;
  name: string;
  from: ExposureSource[];
  reasons: PersonalReason[];
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
  /** what this week's log, the shelf or a place holds that matters more for this person, heaviest first (at most four) */
  mattersMoreForYou: PersonalItem[];
}

export const SELF_ASSESSMENT_CADENCE_DAYS = 90; // quarterly -- the tighter of the "quarterly/biannual" range this feature targets

/**
 * Topic choice, measured on the simulated lives before it was picked (2026-10-02): counting raw tag hits taught "dose-response"
 * almost every week, because 33 of the 41 substances carry that tag. Weighting each tag by how distinctive it is (inverse
 * document frequency across the database), teaching what matters more for the person first, and rotating weekly among the
 * strong candidates gave every simulated person 3-6 relevant topics in 11 weeks instead of 1-2, and covered both of the
 * pregnant persona's relevances (pregnancy and asthma).
 */
const STRONG_FRACTION = 0.5;
const MAX_ROTATION = 3;

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

/** How distinctive each concept tag is across the whole database: ln(substances / substances carrying the tag). */
function tagDistinctiveness(substancesById: Record<string, Substance>): Record<string, number> {
  const all = Object.values(substancesById);
  const carrying: Record<string, number> = {};
  for (const s of all) for (const t of s.concept_tags ?? []) carrying[t] = (carrying[t] ?? 0) + 1;
  return Object.fromEntries(Object.entries(carrying).map(([t, n]) => [t, Math.log(all.length / n)]));
}

function chooseTag(
  weighted: WeightedSubstance[],
  personalTags: Set<string>,
  substancesById: Record<string, Substance>,
  concepts: Record<string, Concept>,
  week: number
): string | null {
  const idf = tagDistinctiveness(substancesById);
  const scores = new Map<string, number>();
  for (const w of weighted) {
    for (const tag of substancesById[w.substanceId]?.concept_tags ?? []) {
      if (!concepts[tag]) continue;
      scores.set(tag, (scores.get(tag) ?? 0) + w.weight * (idf[tag] ?? 0));
    }
  }
  const ranked = (keep: (tag: string) => boolean) =>
    [...scores.entries()].filter(([t, s]) => s > 0 && keep(t)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const personal = ranked((t) => personalTags.has(t));
  const pool = personal.length > 0 ? personal : ranked(() => true);
  if (pool.length === 0) return null;
  const strong = pool.filter(([, s]) => s >= pool[0][1] * STRONG_FRACTION).slice(0, MAX_ROTATION);
  return strong[week % strong.length][0];
}

const SOURCE_WORDS: Record<ExposureSource, string> = { log: msg("this week's log"), shelf: msg("your shelf"), places: msg("your places") };

function pickEducationTopic(
  weighted: WeightedSubstance[],
  personal: ReturnType<typeof personalRelevance>,
  substancesById: Record<string, Substance>,
  now: Date
): EducationTopic {
  const concepts = loadConcepts();
  const personalTags = new Set(personal.flatMap((p) => p.reasons.map((r) => r.conceptTag)));
  const chosen = chooseTag(weighted, personalTags, substancesById, concepts, isoWeekNumber(now));
  const tag = chosen ?? FALLBACK_CONCEPT_ROTATION[isoWeekNumber(now) % FALLBACK_CONCEPT_ROTATION.length];
  const concept: Concept = concepts[tag] ?? concepts[FALLBACK_CONCEPT_ROTATION[0]];

  let why = tr("Nothing in this week's log, on your shelf or in your places points at a topic yet, so this one comes from a rotating list.");
  if (chosen) {
    const contributors = weighted.filter((w) => substancesById[w.substanceId]?.concept_tags.includes(chosen)).slice(0, 2);
    const sources = (["log", "shelf", "places"] as ExposureSource[]).filter((s) => contributors.some((c) => c.from.includes(s)));
    const names = contributors.map((c) => tr(substancesById[c.substanceId]?.name ?? c.substanceId));
    why = tr("From {sources}: {names}.", { sources: listWords(sources.map((s) => tr(SOURCE_WORDS[s]))), names: listWords(names) });
  }

  const seen = new Set<string>();
  const personalForTopic = chosen
    ? personal
        .flatMap((p) => p.reasons)
        .filter((r) => r.conceptTag === chosen && !seen.has(r.label) && (seen.add(r.label), true))
    : [];

  return { conceptId: concept.id, title: concept.name, text: concept.general, technical: concept.technical, why, personal: personalForTopic };
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
    message = tr(
      "No biomarkers logged yet. A quarterly or twice-a-year check-in -- resting heart rate, a basic metabolic panel, whatever's accessible to you -- gives your own body data to validate against, not just logged habits."
    );
  } else if (dueForCheckIn) {
    message = tr("It's been {n} days since your last biomarker log -- worth considering a check-in if you're due for quarterly or biannual testing.", { n: daysSinceLastBiomarker });
  } else {
    message = trn(daysSinceLastBiomarker, "Last biomarker logged {n} day ago -- you're within a typical quarterly window.", "Last biomarker logged {n} days ago -- you're within a typical quarterly window.");
  }

  return { daysSinceLastBiomarker, dueForCheckIn, message };
}

export function buildWeeklyDigest(
  report: ScoreReport,
  substancesById: Record<string, Substance>,
  recentBiomarkers: BiomarkerLog[],
  now: Date = new Date(),
  ctx: DigestContext = {}
): WeeklyDigest {
  const loggedTypes = new Set(Object.keys(report.practice_summary));
  const healthyBehaviorsToConsider = ADDING_GOOD_PRACTICE_TYPES.filter((pt) => !loggedTypes.has(pt)).map((pt) => ({
    practiceType: pt,
    label: PRACTICE_LABELS[pt],
  }));

  const weighted = weightedExposure(report, ctx.standing ?? []);
  const personal = personalRelevance(weighted, ctx.profile ?? null, substancesById);

  return {
    indicator: report.awareness_band,
    healthyBehaviorsToConsider,
    educationTopic: pickEducationTopic(weighted, personal, substancesById, now),
    selfAssessment: buildSelfAssessment(recentBiomarkers, now),
    mattersMoreForYou: personal.slice(0, 4).map((p) => ({
      substanceId: p.substanceId,
      name: substancesById[p.substanceId]?.name ?? p.substanceId,
      from: p.from,
      reasons: p.reasons,
    })),
  };
}
