import * as db from "../storage/db";
import * as quests from "./quests";
import { computePlant, type PlantState } from "./plant";
import { daysAgoISO, todayISO } from "../util/dates";

export interface TodayCare {
  watered: boolean;
  learned: boolean;
  checkedIn: boolean;
}

export async function getPlant(now: Date = new Date()): Promise<{ plant: PlantState; today: TodayCare }> {
  const since = daysAgoISO(13, now);
  const today = todayISO(now);
  const week = daysAgoISO(6, now);

  const starter = await quests.getStarterJourneyStatus();
  const done = starter.quests.filter((q) => q.completed).length;

  const [logDates, checkins, metrics, actions, learning] = await Promise.all([
    db.getDistinctLogDates(30),
    db.getCheckInLogs(30),
    db.getDailyMetrics(30),
    db.getCompletedActions(since),
    db.getLearningDates(since),
  ]);

  const careDates = new Set<string>([
    ...logDates,
    ...checkins.map((c) => c.log_date),
    ...metrics.map((m) => m.log_date),
    ...actions.map((a) => a.completed_date),
    ...learning,
  ]);
  const latest = [...careDates].sort().reverse()[0] ?? null;
  const daysSinceCare = latest ? Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${latest}T00:00:00Z`)) / 86400000)) : null;

  const plant = computePlant({
    starterDone: done,
    starterTotal: starter.quests.length,
    daysSinceCare,
    learningDaysLast7: new Set(learning.filter((d) => d >= week)).size,
    checkInDaysLast7: new Set(checkins.filter((c) => c.log_date >= week).map((c) => c.log_date)).size,
  });

  return {
    plant,
    today: {
      watered: careDates.has(today),
      learned: learning.includes(today),
      checkedIn: checkins.some((c) => c.log_date === today),
    },
  };
}
