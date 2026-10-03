/**
 * The vocabulary of the wellness score.
 *
 * Every part of the score is a SIGNAL: something the person does gets measured, and the measurement is
 * COMPARED with something -- a public-health guideline, the app's own reference rules, a routine cadence,
 * a curriculum, or the person's own earlier self. A signal never returns a bare number: it returns the
 * number, how much evidence stands behind it, and the comparison in words, so the score can always answer
 * "compared with what?".
 *
 * Adding a new kind of activity means adding a signal (or feeding an existing one) and classifying the
 * activity in registry.ts. The registry is checked at compile time and in tests, so an activity cannot be
 * recorded without saying how it factors into the picture -- or why it deliberately does not.
 */
import type { BiomarkerLog, CheckInLog, DailyMetricLog, LogStore, Substance, UserProfile } from "../types";
import type { ShelfItem, ProductKind } from "../ingredients/types";
import type { Stance } from "../ingredients/assess";
import type { DayTally } from "../scoring";
import type { Place } from "../places/types";
import { msg } from "../../i18n";

/** Everything a person can do that the app records or keeps. */
export type ActivityKind =
  | "food_log"
  | "product_log"
  | "environment_log"
  | "air_quality_log"
  | "practice_log"
  | "biomarker_log"
  | "checkin_log"
  | "daily_numbers"
  | "learning"
  | "shelf_change"
  | "place_check" // an answer about a place, compared with a reference
  | "place_context" // who shares a place, and how much of the week is spent in it
  | "advice_decision"
  | "profile_update"
  | "score_setting"
  | "achievement"
  | "notification_state";

export type SignalKey = "exposure" | "resilience" | "validation" | "shelf" | "places" | "learning";

/** What a measurement was compared with. */
export type ComparisonBasis =
  | "guideline" // a public-health authority's recommended amount (US Physical Activity Guidelines, CDC sleep hours)
  | "reference_rules" // the app's own published rules applied to the person's data (product stances, awareness bands)
  | "cadence" // a routine rhythm (a check-in about every three months, a habit a few days a week)
  | "curriculum" // progress through a defined body of material
  | "own_baseline"; // the person's own earlier self

/** A neutral, non-judging read of a comparison. */
export type ComparisonRead = "on_target" | "close" | "room_to_grow" | "not_enough_yet";

export const READ_LABEL: Record<ComparisonRead, string> = {
  on_target: msg("On target"),
  close: msg("Getting close"),
  room_to_grow: msg("Room to grow"),
  not_enough_yet: msg("Not enough yet"),
};

export interface ComparisonPart {
  label: string;
  basis: ComparisonBasis;
  /** What was measured, in words ("96 min a week; recent weeks count more"). */
  measured: string;
  /** What it was compared with, in words ("US Physical Activity Guidelines: 150 min a week"). */
  against: string;
  /** Measured relative to the reference, 0..1 for display (1 = at the reference). Null when there is nothing to compare yet. */
  ratio: number | null;
  read: ComparisonRead;
}

export interface SignalResult {
  key: SignalKey;
  /** 0..100: how the measured things compare with their references. Meaningless when confidence is 0. */
  value: number;
  /** 0..1: how much evidence stands behind the value. */
  confidence: number;
  parts: ComparisonPart[];
  /** One qualitative sentence. */
  summary: string;
  /** Qualitative detail: what contributed most, what changed against the previous reading. */
  notes: string[];
}

export interface ShelfAssessment {
  id: string;
  name: string;
  kind: ProductKind;
  /** the product's frequency-adjusted signal, on the scale the stance thresholds use */
  signal: number;
  stance: Stance;
}

/** Everything the signals need, read from storage once so the score can be evaluated as of any day. */
export interface SignalData {
  logs: LogStore;
  metrics: DailyMetricLog[];
  biomarkers: BiomarkerLog[];
  checkins: CheckInLog[];
  learning: { ref: string; date: string }[];
  shelf: ShelfItem[];
  places: Place[];
  shelfAssessments: Map<string, ShelfAssessment>;
  /** per-day exposure tallies, keyed by day */
  days: Map<string, DayTally>;
  /** The first day anything was recorded, or null for a brand-new person. */
  firstActivityDay: string | null;
  substances: Substance[];
  profile: UserProfile | null;
}

export interface SignalContext {
  /** The day being evaluated (a local day key): nothing after it exists as far as the signal is concerned. */
  asOf: string;
  data: SignalData;
}

export interface Signal {
  key: SignalKey;
  label: string;
  blurb: string;
  /**
   * What the 0-100 value means, when it is not the obvious "how well this compares": the Validation part's value is how up to
   * date the person's readings are, not what they show -- a receipt says so, so 100 out of 100 for logging a reading is never
   * mistaken for a verdict on the reading itself.
   */
  valueMeans?: string;
  defaultWeight: number;
  /** The activities that feed this signal. */
  sources: ActivityKind[];
  evaluate(ctx: SignalContext): SignalResult;
}
