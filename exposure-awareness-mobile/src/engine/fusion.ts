/**
 * The Fusion Engine: the synthesis layer that ties together everything else in this
 * app into two output tiers, per the product framing --
 *
 *   ACUTE outputs: react to what was JUST logged. This is exactly This Week's Focus +
 *   Quick Wins from engine/scoring.ts -- not duplicated here, just surfaced through one
 *   door.
 *
 *   AGGREGATE outputs: react to the accumulated PATTERN across weeks -- trend direction
 *   (engine/trends.ts), journey/quest position (engine/quests.ts), and validation
 *   signal from the user's own biomarker data. Synthesized into one "where you are and
 *   what's next" recommendation, instead of three separate screens the user has to
 *   mentally combine themselves.
 *
 * The "validate via biofeedback" part of the ask is handled honestly, not cleverly: this
 * module surfaces the user's own biomarker entries SIDE BY SIDE with the exposure trend
 * and explicitly does NOT compute a correlation between them. That's a deliberate,
 * previously-established boundary (see ADVANCED_TIER.md and the mobile README's design
 * decisions) -- a real correlation claim from a handful of self-tracked points would be
 * statistically dishonest, and "two lines a person can eyeball together" is more useful
 * and more honest than a fabricated single number claiming they're related.
 */
import * as db from "../storage/db";
import { scoreLogs } from "./scoring";
import { getWeeklyHistory, type WeeklyPoint } from "./trends";
import { getStarterJourneyStatus } from "./quests";
import { getAdviceInputs } from "./adviceState";
import type { BiomarkerLog, ScoreReport } from "./types";
import { daysAgoISO, todayISO } from "../util/dates";

export type TrendDirection = "improving" | "flat" | "worsening" | "not_enough_data";

export type JourneyPosition = "Getting Started" | "Building Momentum" | "Maintaining";

export interface FusionReport {
  acute: {
    focusItems: ScoreReport["focus_items"];
    quickWins: ScoreReport["quick_wins"];
  };
  aggregate: {
    scoreTrend: TrendDirection;
    practiceTrend: TrendDirection;
    journeyProgressPct: number;
    position: JourneyPosition;
    recommendedNextStep: { label: string; detail: string; source: "starter_journey" | "focus" } | null;
    history: WeeklyPoint[];
  };
  validation: {
    recentBiomarkers: BiomarkerLog[];
    hasValidationData: boolean;
    note: string;
  };
}

/** How the Dashboard words each direction. Exposure: lower is better; practices: higher is better.
 * A direction is information, not a verdict, so the wording stays neutral. */
export const TREND_LABELS: Record<"exposure" | "practices", Record<TrendDirection, string>> = {
  exposure: { improving: "↓ easing", worsening: "↑ picking up", flat: "→ steady", not_enough_data: "no trend yet" },
  practices: { improving: "↑ growing", worsening: "↓ tapering", flat: "→ steady", not_enough_data: "no trend yet" },
};

/** Smallest week-over-week change worth naming, in the metric's own units (points, practices). */
const MIN_TREND_STEP = 2;
/** The exposure score is only comparable across weeks whose logging volume is within this factor of the usual week. */
const VOLUME_RANGE = 2;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sampleSd = (xs: number[]) => (xs.length < 3 ? 0 : Math.sqrt(xs.reduce((s, x) => s + (x - mean(xs)) ** 2, 0) / (xs.length - 1)));

/**
 * Where the latest week sits against the weeks before it, judged against this person's own
 * week-to-week variation instead of "any difference is a trend". A point or two either way is
 * what an ordinary week looks like: the engine soak run found the older rule named a direction on
 * 74% of days for simulated users whose behaviour never changed. (Most of that noise was scanned
 * products landing as one-off points -- see scoreLogs -- and the rest was ordinary week-to-week
 * variation, which the noise band absorbs; together they bring it to about 9%.)
 *
 * The exposure score also grows with how much was logged, so a quieter week would read as
 * "improving" just because less was written down. When the latest week's logging volume is under
 * half or over double the usual, the comparison isn't like-for-like and it says so instead. (Tried
 * and dropped: normalising per entry -- it multiplied false claims, because which entries get
 * logged is not proportional to what is eaten; and tighter volume limits, which only removed days
 * without lowering the false-claim rate.)
 *
 * Reports "not_enough_data" (rather than a direction computed from noise) when fewer than two
 * weeks have any activity, or when the latest week has none.
 */
export function directionFrom(history: WeeklyPoint[], key: "overallScore" | "practicesLogged", higherIsBetter: boolean): TrendDirection {
  const isActive = (h: WeeklyPoint) => h.entriesLogged > 0 || h.practicesLogged > 0 || h.quickWinsCompleted > 0;
  if (history.filter(isActive).length < 2) return "not_enough_data";

  const recent = history[history.length - 1];
  const earlier = history.slice(0, -1).filter(isActive);
  if (!isActive(recent) || earlier.length === 0) return "not_enough_data";

  if (key === "overallScore") {
    const usual = mean(earlier.map((h) => h.entriesLogged));
    if (usual > 0 && (recent.entriesLogged < usual / VOLUME_RANGE || recent.entriesLogged > usual * VOLUME_RANGE)) return "not_enough_data";
  }

  const values = earlier.map((h) => h[key]);
  const usualValue = mean(values);
  const change = recent[key] - usualValue;
  if (Math.abs(change) <= Math.max(MIN_TREND_STEP, sampleSd(values))) return "flat";
  return (higherIsBetter ? change > 0 : change < 0) ? "improving" : "worsening";
}

/** Where the person is in the first steps, by how many are done (no points or levels behind it). */
export function journeyPosition(journeyProgressPct: number): JourneyPosition {
  if (journeyProgressPct < 20) return "Getting Started";
  if (journeyProgressPct < 60) return "Building Momentum";
  return "Maintaining";
}

export async function getFusionReport(): Promise<FusionReport> {
  const today = todayISO();
  const weekAgo = daysAgoISO(6);

  const [logs, completedKeys, history, starter, recentBiomarkers, advice] = await Promise.all([
    db.getLogsForRange(weekAgo, today),
    db.getCompletedActionKeys(daysAgoISO(13)),
    getWeeklyHistory(6),
    getStarterJourneyStatus(),
    db.getBiomarkerLogs(5),
    getAdviceInputs(),
  ]);

  const report = scoreLogs(logs, undefined, completedKeys, advice);

  const scoreTrend = directionFrom(history, "overallScore", /* higherIsBetter */ false);
  const practiceTrend = directionFrom(history, "practicesLogged", /* higherIsBetter */ true);
  const journeyProgressPct = Math.round((starter.done / Math.max(1, starter.total)) * 100);

  let recommendedNextStep: FusionReport["aggregate"]["recommendedNextStep"] = null;
  const nextStarter = starter.quests.find((q) => !q.completed);
  if (nextStarter) {
    recommendedNextStep = { label: nextStarter.title, detail: nextStarter.action, source: "starter_journey" };
  } else if (report.focus_items.length > 0) {
    recommendedNextStep = { label: report.focus_items[0].source, detail: report.focus_items[0].tip, source: "focus" };
  }

  return {
    acute: {
      focusItems: report.focus_items,
      quickWins: report.quick_wins,
    },
    aggregate: {
      scoreTrend,
      practiceTrend,
      journeyProgressPct,
      position: journeyPosition(journeyProgressPct),
      recommendedNextStep,
      history,
    },
    validation: {
      recentBiomarkers,
      hasValidationData: recentBiomarkers.length > 0,
      note:
        recentBiomarkers.length > 0
          ? "Shown alongside your exposure trend for your own eyeballing, deliberately not correlated into a single number -- that would need real statistical rigor a handful of self-tracked points can't support."
          : "No biomarkers logged yet. Optional -- see the Biomarkers tab if you track HRV, grip strength, lab results, or similar.",
    },
  };
}
