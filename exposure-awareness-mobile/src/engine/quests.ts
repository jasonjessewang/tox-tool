/**
 * RPG-style quest layer on top of the same non-fear-based invariant as achievements.ts:
 * every quest rewards a constructive ACTION (logging, taking a Quick Win, resting), never
 * the content of what got logged. XP accumulates into a Level -- pure flavor on top of
 * real completions, not a second scoring system.
 *
 * Completions reuse the existing `completed_actions` table (same one achievements.ts and
 * the dashboard's "Mark as done" already write to) with namespaced tip_keys:
 *   - starter quest:  "starter:<id>"
 *   - daily quest:    "daily:<id>:<yyyy-mm-dd>"
 *   - weekly quest:   "weekly:<id>:<yyyy-Www>"
 * No new tables needed -- one completion ledger for the whole app.
 */
import * as db from "../storage/db";
import { loadHazardDb } from "./scoring";
import { STARTER_JOURNEY, STARTER_JOURNEY_TOTAL_XP, type StarterQuest } from "../data/starterJourney";
import { daysAgoISO, todayISO } from "../util/dates";

export interface DailyQuest {
  id: string;
  title: string;
  xp: number;
  check: (ctx: QuestContext) => boolean;
}

export interface WeeklyQuest {
  id: string;
  title: string;
  xp: number;
  check: (ctx: QuestContext) => boolean;
}

interface QuestContext {
  loggedAnythingToday: boolean;
  loggedFoodToday: boolean;
  loggedPracticeToday: boolean;
  quickWinsCompletedThisWeek: number;
  airQualityLoggedThisWeek: number;
  distinctCategoriesThisWeek: number;
  practicesThisWeek: number;
}

export const DAILY_QUESTS: DailyQuest[] = [
  { id: "log_anything", title: "Log one thing today, anywhere", xp: 5, check: (c) => c.loggedAnythingToday },
  { id: "log_food", title: "Log today's breakfast or a meal", xp: 5, check: (c) => c.loggedFoodToday },
  { id: "log_practice", title: "Log a reset practice (sleep, hydration, walk, stretch)", xp: 5, check: (c) => c.loggedPracticeToday },
];

export const WEEKLY_QUESTS: WeeklyQuest[] = [
  { id: "two_quick_wins", title: "Complete 2 Quick Wins this week", xp: 20, check: (c) => c.quickWinsCompletedThisWeek >= 2 },
  { id: "air_quality_3x", title: "Log air quality 3 times this week", xp: 15, check: (c) => c.airQualityLoggedThisWeek >= 3 },
  { id: "full_picture_week", title: "Log all 5 categories this week", xp: 20, check: (c) => c.distinctCategoriesThisWeek >= 5 },
  { id: "practices_3x", title: "Log 3 reset practices this week", xp: 15, check: (c) => c.practicesThisWeek >= 3 },
];

function isoWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

async function buildContext(): Promise<QuestContext> {
  const today = todayISO();
  const weekStart = daysAgoISO(6);
  const todayLogs = await db.getLogsForRange(today, today);
  const weekLogs = await db.getLogsForRange(weekStart, today);
  const completedKeys = await db.getCompletedActionKeys(weekStart);
  const substancesById = Object.fromEntries(loadHazardDb().map((s) => [s.id, s]));

  // Mirrors engine/achievements.ts's quick-win detection: a completion counts as a
  // Quick Win only if its source substance (or synthetic produce/air-quality tip) is
  // actually tagged low-effort -- not just "any non-quest completion."
  let quickWinsCompleted = 0;
  for (const key of completedKeys) {
    if (key.startsWith("starter:") || key.startsWith("daily:") || key.startsWith("weekly:")) continue;
    if (key.startsWith("produce:") || key.startsWith("air_quality:")) {
      quickWinsCompleted += 1;
      continue;
    }
    const substanceId = key.split(":")[0];
    if (substancesById[substanceId]?.action_effort === "low") quickWinsCompleted += 1;
  }

  const distinctCategories = (["food", "products", "environment", "air_quality", "practices"] as const).filter(
    (cat) => weekLogs[cat].length > 0
  ).length;

  return {
    loggedAnythingToday:
      todayLogs.food.length + todayLogs.products.length + todayLogs.environment.length + todayLogs.air_quality.length + todayLogs.practices.length > 0,
    loggedFoodToday: todayLogs.food.length > 0,
    loggedPracticeToday: todayLogs.practices.length > 0,
    quickWinsCompletedThisWeek: quickWinsCompleted,
    airQualityLoggedThisWeek: weekLogs.air_quality.length,
    distinctCategoriesThisWeek: distinctCategories,
    practicesThisWeek: weekLogs.practices.length,
  };
}

export async function getStarterJourneyStatus(): Promise<{ quests: (StarterQuest & { completed: boolean })[]; xpEarned: number; totalXp: number }> {
  const completed = await db.getCompletedActionKeys();
  const quests = STARTER_JOURNEY.map((q) => ({ ...q, completed: completed.has(`starter:${q.id}`) }));
  const xpEarned = quests.filter((q) => q.completed).reduce((sum, q) => sum + q.xp, 0);
  return { quests, xpEarned, totalXp: STARTER_JOURNEY_TOTAL_XP };
}

export async function completeStarterQuest(id: string) {
  const quest = STARTER_JOURNEY.find((q) => q.id === id);
  if (!quest) return;
  await db.markActionCompleted(`starter:${id}`, quest.title, todayISO());
}

export async function getDailyQuestStatus(): Promise<{ quests: (DailyQuest & { completed: boolean })[] }> {
  const ctx = await buildContext();
  const today = todayISO();
  const completed = await db.getCompletedActionKeys(today);
  return {
    quests: DAILY_QUESTS.map((q) => ({
      ...q,
      completed: completed.has(`daily:${q.id}:${today}`) || q.check(ctx),
    })),
  };
}

export async function completeDailyQuest(id: string) {
  const quest = DAILY_QUESTS.find((q) => q.id === id);
  if (!quest) return;
  const today = todayISO();
  await db.markActionCompleted(`daily:${id}:${today}`, quest.title, today);
}

export async function getWeeklyQuestStatus(): Promise<{ quests: (WeeklyQuest & { completed: boolean })[] }> {
  const ctx = await buildContext();
  const weekKey = isoWeekKey();
  const completed = await db.getCompletedActionKeys(daysAgoISO(6));
  return {
    quests: WEEKLY_QUESTS.map((q) => ({
      ...q,
      completed: completed.has(`weekly:${q.id}:${weekKey}`) || q.check(ctx),
    })),
  };
}

export async function completeWeeklyQuest(id: string) {
  const quest = WEEKLY_QUESTS.find((q) => q.id === id);
  if (!quest) return;
  const weekKey = isoWeekKey();
  await db.markActionCompleted(`weekly:${id}:${weekKey}`, quest.title, todayISO());
}

/**
 * A daily or weekly quest that the person's own activity has completed is recorded as completed, so its XP counts.
 * (The screen has always shown these as done the moment the activity happened, but only a tap on an unfinished quest ever
 * recorded one -- so doing the thing earned nothing, and the only way to earn XP was the honor-system tap.)
 * Idempotent: safe after every activity and on every read.
 */
export async function recordAutoQuestCompletions(): Promise<string[]> {
  const ctx = await buildContext();
  const today = todayISO();
  const weekKey = isoWeekKey();
  const done = await db.getCompletedActionKeys(daysAgoISO(6));
  const recorded: string[] = [];
  for (const q of DAILY_QUESTS) {
    if (q.check(ctx) && !done.has(`daily:${q.id}:${today}`)) {
      await completeDailyQuest(q.id);
      recorded.push(`daily:${q.id}`);
    }
  }
  for (const q of WEEKLY_QUESTS) {
    if (q.check(ctx) && !done.has(`weekly:${q.id}:${weekKey}`)) {
      await completeWeeklyQuest(q.id);
      recorded.push(`weekly:${q.id}`);
    }
  }
  return recorded;
}

export interface LevelStatus {
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

/** Pure, directly-testable level curve: level N needs N*50 XP (Level 1 -> 50xp,
 * Level 2 -> 100xp more, etc.) -- gentle on purpose, not tuned for engagement-maximizing
 * grind, matching the rest of the app's non-manipulative design intent. */
export function computeLevel(totalXp: number): LevelStatus {
  let level = 1;
  let remaining = totalXp;
  let needed = 50;
  while (remaining >= needed) {
    remaining -= needed;
    level += 1;
    needed = level * 50;
  }
  return { totalXp, level, xpIntoLevel: remaining, xpForNextLevel: needed };
}

/** Total XP across starter + all-time daily/weekly completions, and the resulting level. */
export async function getLevelStatus(): Promise<LevelStatus> {
  try {
    await recordAutoQuestCompletions();
  } catch {
    // reading the level must never fail because crediting could not be done
  }
  const allCompleted = await db.getCompletedActionKeys();
  let totalXp = 0;
  for (const key of allCompleted) {
    if (key.startsWith("starter:")) {
      const id = key.slice("starter:".length);
      totalXp += STARTER_JOURNEY.find((q) => q.id === id)?.xp ?? 0;
    } else if (key.startsWith("daily:")) {
      const id = key.split(":")[1];
      totalXp += DAILY_QUESTS.find((q) => q.id === id)?.xp ?? 0;
    } else if (key.startsWith("weekly:")) {
      const id = key.split(":")[1];
      totalXp += WEEKLY_QUESTS.find((q) => q.id === id)?.xp ?? 0;
    }
  }
  return computeLevel(totalXp);
}
