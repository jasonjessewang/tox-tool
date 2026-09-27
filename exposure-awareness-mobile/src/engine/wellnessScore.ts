/**
 * The composite score: one number that reflects how your logged pattern, your "adding good" habits, your own
 * biomarkers, your shelf and your understanding fit together -- the InBody-style "one number, with a breakdown,
 * that you can reweight" this app was asked for.
 *
 * It is built from SIGNALS (engine/signals), each of which compares something you did with a reference and says how
 * sure it is. Two numbers come out, and they are kept apart on purpose:
 *
 *   overall   -- how the parts we can see compare with their references (0-100). Each part counts in proportion to its
 *                weight AND to how much evidence stands behind it, so a part with nothing behind it does not drag the
 *                score down (and does not prop it up either): it simply is not in the picture yet.
 *   coverage  -- how much of the picture we can see (0-100%): the weight-and-evidence share. This is what filling in
 *                the app raises. Below PROVISIONAL_COVERAGE the number is labelled early instead of being trusted.
 *
 * Keeping them apart means logging more never lowers the score because more got flagged, and going quiet fades the
 * coverage instead of crashing the score. Every part also carries its comparison in words and its change against
 * the person's own earlier self.
 *
 * This is NOT a toxicological risk score and never mixes with overall_score/awareness_band -- it's a personal dashboard
 * number, closer to a fitness-app readiness score than a medical measurement.
 */
import { SIGNALS } from "./signals/registry";
import type { ActivityKind, ComparisonPart, SignalKey, SignalResult } from "./signals/types";

export type WeightKey = SignalKey;

export const DEFAULT_WEIGHTS = Object.fromEntries(SIGNALS.map((s) => [s.key, s.defaultWeight])) as Record<WeightKey, number>;

export const COMPONENT_INFO = Object.fromEntries(SIGNALS.map((s) => [s.key, { label: s.label, blurb: s.blurb }])) as Record<WeightKey, { label: string; blurb: string }>;

export type ScoreBand = "building" | "steady" | "strong" | "excellent";

export const BAND_INFO: Record<ScoreBand, { label: string; description: string }> = {
  building: { label: "Building", description: "Room to grow -- every log, swap and lesson moves this." },
  steady: { label: "Steady", description: "A real pattern is forming." },
  strong: { label: "Strong", description: "Consistently feeding and validating the engine." },
  excellent: { label: "Excellent", description: "About as complete and as good a picture as this app can build." },
};

/** Below this share of the picture visible, a number would over-claim. */
export const PROVISIONAL_COVERAGE = 40;

export const EARLY_PICTURE = { label: "Early picture", description: "This firms up as you log -- right now it rests on only part of what the app can see." };

export interface Change {
  window: string;
  /** points of the 0-100 value, this reading minus the earlier one */
  change: number;
}

export interface ScoreComponent {
  key: WeightKey;
  label: string;
  blurb: string;
  /** what the value means, when it is not the obvious "how well this compares" (see Signal.valueMeans) */
  valueMeans?: string;
  /** the part's own 0-100 reading (same as `value`; kept for callers that predate signals) */
  raw: number;
  value: number;
  /** 0..1: how much evidence stands behind the value */
  confidence: number;
  /** the user's weight, normalized so all parts total 100 */
  weight: number;
  /** the share (0-100) of the score this part carries right now: weight x confidence, out of all parts */
  influence: number;
  /** points of the overall this part accounts for */
  contribution: number;
  /** one qualitative sentence */
  detail: string;
  parts: ComparisonPart[];
  notes: string[];
  /** the activities that feed this part */
  sources: ActivityKind[];
  vsBefore: Change | null;
}

export interface WellnessScore {
  overall: number;
  /** 0-100: how much of the picture is visible */
  coverage: number;
  /** coverage is below PROVISIONAL_COVERAGE: show it as an early reading */
  provisional: boolean;
  band: ScoreBand;
  components: ScoreComponent[];
  vsBefore: Change | null;
  asOf: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function bandFor(overall: number, provisional: boolean): ScoreBand {
  if (provisional) return "building";
  if (overall >= 80) return "excellent";
  if (overall >= 60) return "strong";
  if (overall >= 35) return "steady";
  return "building";
}

/**
 * Below this share of the picture the app can see, there is no number to show: a first meal, a first night's sleep and a first
 * reading would add up to a confident-looking figure (89 after four entries, in the walkthrough) that says almost nothing.
 * The parts still show what they compared and how much evidence stands behind them.
 */
export const NUMBER_MIN_COVERAGE = 20;
export const showsNumber = (score: Pick<WellnessScore, "coverage">) => score.coverage >= NUMBER_MIN_COVERAGE;

/** The label and description to show for a score: the band's, or the early-picture wording while coverage is thin. */
export function describeScore(score: Pick<WellnessScore, "band" | "provisional" | "coverage">): { label: string; description: string } {
  return score.provisional
    ? { label: EARLY_PICTURE.label, description: EARLY_PICTURE.description }
    : BAND_INFO[score.band];
}

export function normalizeWeights(weights: Partial<Record<WeightKey, number>>): Record<WeightKey, number> {
  const keys = Object.keys(DEFAULT_WEIGHTS) as WeightKey[];
  const raw = keys.map((k) => Math.max(0, weights[k] ?? DEFAULT_WEIGHTS[k]));
  const total = raw.reduce((a, b) => a + b, 0);
  if (total <= 0) return { ...DEFAULT_WEIGHTS };
  const out = {} as Record<WeightKey, number>;
  keys.forEach((k, i) => (out[k] = (raw[i] / total) * 100));
  return out;
}

export function composeWellnessScore(results: SignalResult[], weights: Partial<Record<WeightKey, number>> = DEFAULT_WEIGHTS, asOf = ""): WellnessScore {
  const w = normalizeWeights(weights);
  const carried = results.map((r) => w[r.key] * r.confidence);
  const seen = carried.reduce((a, b) => a + b, 0);
  const coverage = Math.min(100, seen);
  const overall = seen > 0 ? results.reduce((sum, r, i) => sum + carried[i] * r.value, 0) / seen : 0;
  const provisional = coverage < PROVISIONAL_COVERAGE;

  const components: ScoreComponent[] = results.map((r, i) => {
    const signal = SIGNALS.find((s) => s.key === r.key)!;
    const influence = seen > 0 ? (carried[i] / seen) * 100 : 0;
    return {
      key: r.key,
      label: signal.label,
      blurb: signal.blurb,
      valueMeans: signal.valueMeans,
      raw: round1(r.value),
      value: round1(r.value),
      confidence: Math.round(r.confidence * 100) / 100,
      weight: round1(w[r.key]),
      influence: round1(influence),
      contribution: round1((influence * r.value) / 100),
      detail: r.summary,
      parts: r.parts,
      notes: r.notes,
      sources: signal.sources,
      vsBefore: null,
    };
  });

  const rounded = Math.round(overall);
  return { overall: rounded, coverage: Math.round(coverage), provisional, band: bandFor(rounded, provisional), components, vsBefore: null, asOf };
}

/** A part's reading only says something about change when both readings had real evidence behind them. */
const MIN_CONFIDENCE_FOR_CHANGE = 0.3;

/** Fills in how every part, and the whole, compares with the person's own earlier self. */
export function compareWithEarlier(current: WellnessScore, earlier: WellnessScore, window = "4 weeks"): WellnessScore {
  const components = current.components.map((c) => {
    const before = earlier.components.find((e) => e.key === c.key);
    const vsBefore = before && c.confidence >= MIN_CONFIDENCE_FOR_CHANGE && before.confidence >= MIN_CONFIDENCE_FOR_CHANGE ? { window, change: Math.round(c.value - before.value) } : null;
    return { ...c, vsBefore };
  });
  const vsBefore = !current.provisional && !earlier.provisional ? { window, change: current.overall - earlier.overall } : null;
  return { ...current, components, vsBefore };
}
