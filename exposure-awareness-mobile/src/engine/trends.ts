/**
 * Weekly history for the trend graphs. Computes overall_score and practice counts for
 * each of the last N weeks by re-running scoreLogs() on rolling 7-day windows -- no
 * separate history table needed, since score_logs is already a pure function of the
 * underlying logs for any date range.
 *
 * Naming carries over the non-fear-based rule from engine/scoring.ts: this is a
 * "flagged-mention trend," not a "risk score" -- see WeeklyPoint's field names and the
 * caveat text the Trends screen surfaces alongside the chart.
 */
import * as db from "../storage/db";
import { scoreLogs } from "./scoring";
import { daysAgoISO } from "../util/dates";
import { monthDay } from "../i18n";

export interface WeeklyPoint {
  weekLabel: string; // e.g. "Sep 1"
  weekStart: string;
  weekEnd: string;
  overallScore: number;
  /** Food, product, environment and air-quality entries in the week: how much evidence the score rests on. */
  entriesLogged: number;
  practicesLogged: number;
  quickWinsCompleted: number;
}

function shortLabel(iso: string) {
  return monthDay(new Date(iso + "T00:00:00"));
}

export async function getWeeklyHistory(weeks = 6): Promise<WeeklyPoint[]> {
  const points: WeeklyPoint[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const weekEnd = daysAgoISO(w * 7);
    const weekStart = daysAgoISO(w * 7 + 6);
    const logs = await db.getLogsForRange(weekStart, weekEnd);
    const completed = await db.getCompletedActionKeys(weekStart);
    const report = scoreLogs(logs, undefined, completed);
    const quickWinsInWindow = report.recommendations.filter(
      (r) => r.action_effort === "low" && r.completed
    ).length;
    points.push({
      weekLabel: shortLabel(weekStart),
      weekStart,
      weekEnd,
      overallScore: report.overall_score,
      entriesLogged: report.entries_analyzed.food + report.entries_analyzed.products + report.entries_analyzed.environment + report.entries_analyzed.air_quality,
      practicesLogged: logs.practices.length,
      quickWinsCompleted: quickWinsInWindow,
    });
  }
  return points;
}
