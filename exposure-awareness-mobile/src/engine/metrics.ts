/**
 * Daily lifestyle numbers (calories, active minutes, screen time) and their week-over-week
 * change. Entered manually for now -- automatic capture from HealthKit / Health Connect
 * needs a development build, not Expo Go. Pure and synchronous like the rest of engine/.
 */
import type { DailyMetricLog, PracticeLog } from "./types";
import { daysAgoISO } from "../util/dates";

export type MetricKey = "calories" | "active_minutes" | "screen_hours";

export interface MetricSummary {
  days: { date: string; label: string; value: number | null }[];
  thisWeekAvg: number | null;
  prevWeekAvg: number | null;
  changePct: number | null;
}

const ACTIVE_PRACTICES = new Set(["exercise", "grounding_stretching"]);

function weekdayLabel(iso: string): string {
  return ["S", "M", "T", "W", "T", "F", "S"][new Date(`${iso}T12:00:00Z`).getUTCDay()];
}

function valueFor(date: string, key: MetricKey, metrics: DailyMetricLog[], practices: PracticeLog[]): number | null {
  const entry = metrics.find((m) => m.log_date === date);
  const direct = entry ? entry[key] : null;
  if (direct !== null && direct !== undefined) return direct;
  if (key === "active_minutes") {
    const mins = practices
      .filter((p) => p.log_date === date && ACTIVE_PRACTICES.has(p.practice_type))
      .reduce((sum, p) => sum + (p.duration_minutes ?? 0), 0);
    return mins > 0 ? mins : null;
  }
  return null;
}

function avg(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? Math.round((present.reduce((a, b) => a + b, 0) / present.length) * 10) / 10 : null;
}

export function summarizeMetric(key: MetricKey, metrics: DailyMetricLog[], practices: PracticeLog[], now: Date = new Date()): MetricSummary {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = daysAgoISO(6 - i, now);
    return { date, label: weekdayLabel(date), value: valueFor(date, key, metrics, practices) };
  });
  const prev = Array.from({ length: 7 }, (_, i) => valueFor(daysAgoISO(13 - i, now), key, metrics, practices));
  const thisWeekAvg = avg(days.map((d) => d.value));
  const prevWeekAvg = avg(prev);
  const changePct =
    thisWeekAvg !== null && prevWeekAvg !== null && prevWeekAvg > 0
      ? Math.round(((thisWeekAvg - prevWeekAvg) / prevWeekAvg) * 100)
      : null;
  return { days, thisWeekAvg, prevWeekAvg, changePct };
}
