/**
 * Removing an entry is reversible: deleting hands the entry back, and restoring puts it exactly where it was.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as db from "./db";
import type { FoodLog } from "../engine/types";

beforeEach(async () => {
  await AsyncStorage.clear();
});

const add = async (item: string) => {
  // entries are stamped with when they were created; keep them a millisecond apart so newest-first is unambiguous
  await new Promise((r) => setTimeout(r, 3));
  return db.insertFoodLog({ log_date: "2026-09-20", meal: "lunch", food_item: item, processing_level: null, notes: "" });
};
const items = async () => (await db.getRecentLogs(50)).food.map((f) => f.food_item);

test("deleting hands the entry back; restoring puts it back exactly where it was", async () => {
  await add("first");
  const middle = await add("second");
  await add("third");
  expect(await items()).toEqual(["third", "second", "first"]);

  const removed = await db.deleteLog<FoodLog>("food", middle.id);
  expect(removed?.food_item).toBe("second");
  expect(await items()).toEqual(["third", "first"]);

  await db.restoreLog("food", removed!);
  expect(await items()).toEqual(["third", "second", "first"]);
});

test("restoring the newest and the oldest entries keeps the order too", async () => {
  const oldest = await add("a");
  await add("b");
  const newest = await add("c");
  const gone = [await db.deleteLog<FoodLog>("food", newest.id), await db.deleteLog<FoodLog>("food", oldest.id)];
  expect(await items()).toEqual(["b"]);
  await db.restoreLog("food", gone[1]!);
  await db.restoreLog("food", gone[0]!);
  expect(await items()).toEqual(["c", "b", "a"]);
});

test("putting back what is already there does nothing, and deleting what is not there returns nothing", async () => {
  const e = await add("only");
  await db.restoreLog("food", e);
  expect(await items()).toEqual(["only"]);
  expect(await db.deleteLog("food", "no-such-id")).toBeNull();
  expect(await items()).toEqual(["only"]);
});

test("it works the same for every kind of log that has a Delete button", async () => {
  const air = await db.insertAirQualityLog({ log_date: "2026-09-20", location: "Home", pollutant: "PM2.5", value: 12, source: "manual", notes: "" });
  const practice = await db.insertPracticeLog({ log_date: "2026-09-20", practice_type: "sleep", duration_minutes: 420, detail: "", notes: "" });
  const bio = await db.insertBiomarkerLog({ log_date: "2026-09-20", metric: "Resting heart rate", value: 62, unit: "bpm", source: "", notes: "" });
  for (const [category, entry] of [["air_quality", air], ["practices", practice], ["biomarkers", bio]] as const) {
    const removed = await db.deleteLog(category, entry.id);
    expect(removed?.id).toBe(entry.id);
    await db.restoreLog(category, removed!);
  }
  const all = await db.getRecentLogs(50);
  expect([all.air_quality.length, all.practices.length, all.biomarkers.length]).toEqual([1, 1, 1]);
});
