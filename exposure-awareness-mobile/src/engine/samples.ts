/**
 * Turns daily samples from a connected source (via the backend's /v1/metrics/daily) into
 * local log entries WITHOUT overwriting anything the user entered themselves.
 */
import type { DailyMetricLog, PracticeLog } from "./types";

export interface DailySample {
  date: string;
  metric: string;
  value: number;
  sources: string[];
}

export interface ImportPlan {
  metricUpserts: { date: string; calories: number | null; active_minutes: number; screen_hours: number | null }[];
  sleepLogs: { date: string; minutes: number; source: string }[];
}

export function planImport(samples: DailySample[], metrics: DailyMetricLog[], practices: PracticeLog[]): ImportPlan {
  const plan: ImportPlan = { metricUpserts: [], sleepLogs: [] };
  for (const s of samples) {
    const existing = metrics.find((m) => m.log_date === s.date);
    if (s.metric === "active_minutes" && s.value > 0 && existing?.active_minutes == null) {
      plan.metricUpserts.push({
        date: s.date,
        calories: existing?.calories ?? null,
        active_minutes: Math.round(s.value),
        screen_hours: existing?.screen_hours ?? null,
      });
    }
    if (s.metric === "sleep_minutes" && s.value > 0) {
      const hasSleep = practices.some((p) => p.log_date === s.date && p.practice_type === "sleep");
      if (!hasSleep) plan.sleepLogs.push({ date: s.date, minutes: Math.round(s.value), source: s.sources.join(", ") });
    }
  }
  return plan;
}
