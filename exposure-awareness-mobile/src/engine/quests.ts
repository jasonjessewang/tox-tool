/**
 * The Starter Journey's completion state: a plain checklist of first steps.
 *
 * The launch build keeps no points, levels, or daily and weekly quests (calm by design, see engine/calm.ts): a step is
 * either done or not yet, and doing it is its own reward. Completions reuse the existing `completed_actions` table with
 * namespaced tip_keys ("starter:<id>"), so there is one completion ledger for the whole app. Keys written by the earlier
 * daily and weekly quests ("daily:...", "weekly:...") may still be in a person's storage; nothing reads them now.
 */
import * as db from "../storage/db";
import { STARTER_JOURNEY, type StarterQuest } from "../data/starterJourney";
import { todayISO } from "../util/dates";

export async function getStarterJourneyStatus(): Promise<{ quests: (StarterQuest & { completed: boolean })[]; done: number; total: number }> {
  const completed = await db.getCompletedActionKeys();
  const quests = STARTER_JOURNEY.map((q) => ({ ...q, completed: completed.has(`starter:${q.id}`) }));
  return { quests, done: quests.filter((q) => q.completed).length, total: quests.length };
}

export async function completeStarterQuest(id: string) {
  const quest = STARTER_JOURNEY.find((q) => q.id === id);
  if (!quest) return;
  await db.markActionCompleted(`starter:${id}`, quest.title, todayISO());
}
