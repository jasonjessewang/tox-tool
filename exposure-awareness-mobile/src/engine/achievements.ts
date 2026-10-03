/**
 * Port of tox-exposure-tool/engine/achievements.py. Invariant: every milestone rewards a constructive behavior, never
 * the content of what got logged (nothing for a low score, nothing for a high one).
 *
 * Calm launch build (engine/calm.ts): no screen shows badges and nothing fires a notification when one unlocks, and the
 * streak badges are gone. The catalog is kept for the simulation's reports; computeStreak stays because the simulation
 * uses it to check that every entry lands on the person's own calendar day. Nothing here is shown to the person.
 */
import * as db from "../storage/db";
import { loadHazardDb } from "./scoring";
import { tally as produceTally } from "./produce";
import { daysAgoISO } from "../util/dates";
import { msg } from "../i18n";

export interface Achievement {
  key: string;
  name: string;
  icon: string;
  description: string;
  check: (s: Stats) => boolean;
}

interface Stats {
  total_all: number;
  streak: number;
  categories_logged: Set<string>;
  total_completed_actions: number;
  quick_wins_completed: number;
  distinct_lower_tier_produce: number;
  total_practices: number;
  total_air_quality: number;
}

export const CATALOG: Achievement[] = [
  { key: "first_log", name: msg("First Step"), icon: "🌱", description: msg("Logged your first entry."), check: (s) => s.total_all >= 1 },
  { key: "full_picture", name: msg("Full Picture"), icon: "🧩", description: msg("Logged all 5 categories at least once."), check: (s) => s.categories_logged.size >= 5 },
  { key: "focused_1", name: msg("First Action"), icon: "✅", description: msg("Marked a recommendation as done for the first time."), check: (s) => s.total_completed_actions >= 1 },
  { key: "focused_10", name: msg("Action Taker"), icon: "💪", description: msg("Marked 10 recommendations as done."), check: (s) => s.total_completed_actions >= 10 },
  { key: "quick_win_5", name: msg("Low-Hanging Fruit"), icon: "🍎", description: msg("Completed 5 low-effort Quick Win actions."), check: (s) => s.quick_wins_completed >= 5 },
  { key: "produce_diversifier", name: msg("Produce Diversifier"), icon: "🥦", description: msg("Logged 5 different lower-typical-residue produce items."), check: (s) => s.distinct_lower_tier_produce >= 5 },
  { key: "reset_regular", name: msg("Reset Regular"), icon: "🧘", description: msg("Logged 10 resilience practices."), check: (s) => s.total_practices >= 10 },
  { key: "air_aware", name: msg("Air Aware"), icon: "🌬️", description: msg("Logged 5 air quality readings."), check: (s) => s.total_air_quality >= 5 },
];

/**
 * Consecutive days with any entry, ending today -- or ending yesterday if today is still empty.
 * A streak is only "broken" once a whole day has passed without an entry, so opening the app in
 * the morning (before logging anything) must not read as zero. (The engine soak run found that a
 * morning-check-in user saw 0 on every one of 50 pre-logging opens.)
 */
export async function computeStreak(now: Date = new Date()): Promise<number> {
  const dates = new Set(await db.getDistinctLogDates(60));
  let offset = dates.has(daysAgoISO(0, now)) ? 0 : 1;
  let streak = 0;
  while (dates.has(daysAgoISO(offset, now))) {
    streak += 1;
    offset += 1;
  }
  return streak;
}

async function computeStats(): Promise<Stats> {
  const recent = await db.getRecentLogs(100000); // local-only store; no pagination concern
  const streak = await computeStreak();
  const completedKeys = await db.getCompletedActionKeys();
  const substancesById = Object.fromEntries(loadHazardDb().map((s) => [s.id, s]));

  let quickWinsCompleted = 0;
  for (const key of completedKeys) {
    if (key.startsWith("produce:") || key.startsWith("air_quality:")) {
      quickWinsCompleted += 1;
      continue;
    }
    const substanceId = key.split(":")[0];
    if (substancesById[substanceId]?.action_effort === "low") quickWinsCompleted += 1;
  }

  const produceSummary = produceTally(recent.food);
  const categoriesLogged = new Set<string>();
  if (recent.food.length) categoriesLogged.add("food");
  if (recent.products.length) categoriesLogged.add("products");
  if (recent.environment.length) categoriesLogged.add("environment");
  if (recent.air_quality.length) categoriesLogged.add("air_quality");
  if (recent.practices.length) categoriesLogged.add("practices");

  return {
    total_all: recent.food.length + recent.products.length + recent.environment.length + recent.air_quality.length + recent.practices.length,
    streak,
    categories_logged: categoriesLogged,
    total_completed_actions: completedKeys.size,
    quick_wins_completed: quickWinsCompleted,
    distinct_lower_tier_produce: Object.keys(produceSummary.lower_hits).length,
    total_practices: recent.practices.length,
    total_air_quality: recent.air_quality.length,
  };
}

export async function evaluateAndUnlock(): Promise<{ allUnlocked: Set<string>; newlyUnlocked: Achievement[] }> {
  const stats = await computeStats();
  const already = await db.getUnlockedAchievementKeys();
  const newlyUnlocked: Achievement[] = [];

  for (const achievement of CATALOG) {
    if (already.has(achievement.key)) continue;
    if (achievement.check(stats)) {
      const wasNew = await db.unlockAchievement(achievement.key);
      if (wasNew) newlyUnlocked.push(achievement);
    }
  }

  const allUnlocked = new Set([...already, ...newlyUnlocked.map((a) => a.key)]);
  return { allUnlocked, newlyUnlocked };
}
