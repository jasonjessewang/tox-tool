/**
 * Running day-by-day record of what the user actually did this week: check-in, mood,
 * practices ("adding good"), meals logged, actions completed, and the daily numbers.
 * Pure -- callers pass in the rows. Oldest day first, so it reads like a week.
 */
import { PRACTICE_LABELS } from "./scoring";
import { isScanEntry } from "./scanNotes";
import type { CheckInLog, DailyMetricLog, LogStore, Mood } from "./types";
import { daysAgoISO } from "../util/dates";
import { weekdayShort } from "../i18n";

export interface DayRow {
  date: string;
  weekday: string;
  isToday: boolean;
  checkedIn: boolean;
  mood: Mood | null;
  practices: string[];
  /** meals and products the person logged: a scan catalogs a product, it is not a meal eaten */
  meals: number;
  /** products scanned onto the shelf */
  scans: number;
  actions: number;
  calories: number | null;
  activeMinutes: number | null;
  screenHours: number | null;
  hasAnything: boolean;
}

export interface WeekLog {
  days: DayRow[];
  totals: { checkIns: number; practices: number; actions: number; daysActive: number };
}


export function buildWeekLog(
  input: { logs: LogStore; checkins: CheckInLog[]; metrics: DailyMetricLog[]; actions: { completed_date: string }[] },
  now: Date = new Date()
): WeekLog {
  const days: DayRow[] = Array.from({ length: 7 }, (_, i) => {
    const date = daysAgoISO(6 - i, now);
    const checkin = input.checkins.find((c) => c.log_date === date);
    const metric = input.metrics.find((m) => m.log_date === date);
    const practices = [...new Set(input.logs.practices.filter((p) => p.log_date === date).map((p) => PRACTICE_LABELS[p.practice_type] ?? p.practice_type))];
    const dayFood = input.logs.food.filter((f) => f.log_date === date);
    const dayProducts = input.logs.products.filter((p) => p.log_date === date);
    const meals = dayFood.filter((f) => !isScanEntry(f)).length;
    const scans = dayFood.filter(isScanEntry).length + dayProducts.filter(isScanEntry).length;
    const actions = input.actions.filter((a) => a.completed_date === date).length;
    const row: DayRow = {
      date,
      weekday: weekdayShort(date),
      isToday: i === 6,
      checkedIn: !!checkin,
      mood: checkin?.mood ?? null,
      practices,
      meals,
      scans,
      actions,
      calories: metric?.calories ?? null,
      activeMinutes: metric?.active_minutes ?? null,
      screenHours: metric?.screen_hours ?? null,
      hasAnything: false,
    };
    row.hasAnything = row.checkedIn || practices.length > 0 || meals > 0 || scans > 0 || actions > 0 || row.calories !== null || row.activeMinutes !== null || row.screenHours !== null;
    return row;
  });
  return {
    days,
    totals: {
      checkIns: days.filter((d) => d.checkedIn).length,
      practices: days.reduce((s, d) => s + d.practices.length, 0),
      actions: days.reduce((s, d) => s + d.actions, 0),
      daysActive: days.filter((d) => d.hasAnything).length,
    },
  };
}
