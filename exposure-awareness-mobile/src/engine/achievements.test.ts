import AsyncStorage from "@react-native-async-storage/async-storage";
import * as db from "../storage/db";
import { computeStreak } from "./achievements";
import { daysAgoISO, todayISO } from "../util/dates";

// 7:30 am: the person has opened the app but not logged anything yet today.
const morning = new Date(2026, 8, 25, 7, 30);

async function logOn(...daysBack: number[]) {
  for (const n of daysBack) {
    await db.insertPracticeLog({ log_date: daysAgoISO(n, morning), practice_type: "hydration", duration_minutes: null, detail: "", notes: "" });
  }
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("streak", () => {
  test("no entries, no streak", async () => {
    expect(await computeStreak(morning)).toBe(0);
  });

  test("an empty morning does not zero a live streak: yesterday and the day before still count", async () => {
    await logOn(1, 2);
    expect(await computeStreak(morning)).toBe(2);
  });

  test("logging today extends it", async () => {
    await logOn(0, 1, 2);
    expect(await computeStreak(morning)).toBe(3);
  });

  test("today alone is a streak of one", async () => {
    await logOn(0);
    expect(await computeStreak(morning)).toBe(1);
  });

  test("a whole missed day breaks it", async () => {
    await logOn(2, 3, 4);
    expect(await computeStreak(morning)).toBe(0);
  });

  test("a gap ends the run at the gap", async () => {
    await logOn(0, 1, 3, 4, 5);
    expect(await computeStreak(morning)).toBe(2);
  });

  test("counts local days: an entry at 9:30 pm and another at 6:45 am the next day are consecutive days", async () => {
    const evening = new Date(2026, 8, 24, 21, 30);
    const nextMorning = new Date(2026, 8, 25, 6, 45);
    await db.insertPracticeLog({ log_date: todayISO(evening), practice_type: "sleep", duration_minutes: 420, detail: "", notes: "" });
    await db.insertPracticeLog({ log_date: todayISO(nextMorning), practice_type: "hydration", duration_minutes: null, detail: "", notes: "" });
    expect(await computeStreak(new Date(2026, 8, 25, 12))).toBe(2);
  });
});

describe("daily numbers", () => {
  test("numbers saved one evening are not overwritten by the next morning's save (each is its own local day)", async () => {
    const evening = new Date(2026, 8, 24, 21, 30);
    const nextMorning = new Date(2026, 8, 25, 6, 45);
    await db.upsertDailyMetrics({ log_date: todayISO(evening), calories: 2100, active_minutes: 30, screen_hours: 6 });
    await db.upsertDailyMetrics({ log_date: todayISO(nextMorning), calories: 400, active_minutes: null, screen_hours: null });
    const rows = await db.getDailyMetrics(10);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.log_date === "2026-09-24")?.calories).toBe(2100);
    expect(rows.find((r) => r.log_date === "2026-09-25")?.calories).toBe(400);
  });
});
