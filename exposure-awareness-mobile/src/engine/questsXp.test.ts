/**
 * Quests complete from what the person does -- and the XP for them is credited, not just shown.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as db from "../storage/db";
import { getLevelStatus, getDailyQuestStatus, getWeeklyQuestStatus, recordAutoQuestCompletions, DAILY_QUESTS, WEEKLY_QUESTS } from "./quests";
import { runActivity } from "./receipts";
import { todayISO } from "../util/dates";

const NOW = new Date(2026, 8, 23, 12); // a Wednesday

beforeAll(() => {
  jest.useFakeTimers({
    doNotFake: ["nextTick", "setImmediate", "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout", "queueMicrotask", "hrtime", "performance", "requestAnimationFrame", "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback"],
    now: NOW,
  });
});
afterAll(() => jest.useRealTimers());
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.setSystemTime(NOW);
});

const meal = () => db.insertFoodLog({ log_date: todayISO(NOW), meal: "lunch", food_item: "rice and beans", processing_level: null, notes: "" });
const rest = () => db.insertPracticeLog({ log_date: todayISO(NOW), practice_type: "sleep", duration_minutes: 450, detail: "", notes: "" });

test("nothing done, nothing credited", async () => {
  expect((await getDailyQuestStatus()).quests.every((q) => !q.completed)).toBe(true);
  expect((await getLevelStatus()).totalXp).toBe(0);
  expect(await recordAutoQuestCompletions()).toEqual([]);
});

test("logging a meal completes two daily quests and their XP counts (it used to show them done and earn nothing)", async () => {
  await meal();
  const status = (await getDailyQuestStatus()).quests;
  expect(status.filter((q) => q.completed).map((q) => q.id).sort()).toEqual(["log_anything", "log_food"]);
  const level = await getLevelStatus();
  const xp = DAILY_QUESTS.filter((q) => q.id === "log_anything" || q.id === "log_food").reduce((n, q) => n + q.xp, 0);
  expect(level.totalXp).toBe(xp);
});

test("crediting is idempotent: reading again, or doing more, never counts a quest twice", async () => {
  await meal();
  const first = (await getLevelStatus()).totalXp;
  await getLevelStatus();
  await recordAutoQuestCompletions();
  expect((await getLevelStatus()).totalXp).toBe(first);
  await meal();
  expect((await getLevelStatus()).totalXp).toBe(first);
  await rest();
  expect((await getLevelStatus()).totalXp).toBe(first + DAILY_QUESTS.find((q) => q.id === "log_practice")!.xp);
});

test("a day's quests are credited the day they were done, and a new day starts fresh", async () => {
  await meal();
  const day1 = (await getLevelStatus()).totalXp;
  jest.setSystemTime(new Date(2026, 8, 24, 12));
  expect((await getDailyQuestStatus()).quests.every((q) => !q.completed)).toBe(true);
  expect((await getLevelStatus()).totalXp).toBe(day1); // nothing new today, nothing lost from yesterday
  await db.insertFoodLog({ log_date: todayISO(new Date(2026, 8, 24, 12)), meal: "dinner", food_item: "soup", processing_level: null, notes: "" });
  expect((await getLevelStatus()).totalXp).toBeGreaterThan(day1);
});

test("a weekly quest is credited once for the week when its condition is met", async () => {
  for (let i = 0; i < 3; i++) await db.insertPracticeLog({ log_date: todayISO(NOW), practice_type: "hydration", duration_minutes: null, detail: "", notes: "" });
  expect((await getWeeklyQuestStatus()).quests.find((q) => q.id === "practices_3x")!.completed).toBe(true);
  const xp = (await getLevelStatus()).totalXp;
  expect(xp).toBeGreaterThanOrEqual(WEEKLY_QUESTS.find((q) => q.id === "practices_3x")!.xp);
  await recordAutoQuestCompletions();
  expect((await getLevelStatus()).totalXp).toBe(xp);
});

test("recording an activity through runActivity credits the quest at that moment, without anyone opening the Journey", async () => {
  expect((await getLevelStatus()).totalXp).toBe(0);
  await runActivity("food_log", meal, { now: NOW });
  const keys = await db.getCompletedActionKeys(todayISO(NOW));
  expect(keys.has(`daily:log_food:${todayISO(NOW)}`)).toBe(true);
});
