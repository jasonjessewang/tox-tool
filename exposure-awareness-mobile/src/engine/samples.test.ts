import { planImport } from "./samples";
import type { DailyMetricLog, PracticeLog } from "./types";

const m = (over: Partial<DailyMetricLog>): DailyMetricLog => ({ id: "1", log_date: "2026-06-01", calories: null, active_minutes: null, screen_hours: null, created_at: "", ...over });

test("imports active minutes into an empty day", () => {
  const p = planImport([{ date: "2026-06-01", metric: "active_minutes", value: 44.6, sources: ["strava"] }], [], []);
  expect(p.metricUpserts).toEqual([{ date: "2026-06-01", calories: null, active_minutes: 45, screen_hours: null }]);
});

test("never overwrites what the user typed, but preserves their other fields when filling a gap", () => {
  const s = [{ date: "2026-06-01", metric: "active_minutes", value: 30, sources: ["strava"] }];
  expect(planImport(s, [m({ active_minutes: 60 })], []).metricUpserts).toHaveLength(0);
  expect(planImport(s, [m({ calories: 2000, screen_hours: 3 })], []).metricUpserts[0]).toMatchObject({ calories: 2000, screen_hours: 3, active_minutes: 30 });
});

test("sleep becomes a sleep practice only if none is logged that day", () => {
  const s = [{ date: "2026-06-01", metric: "sleep_minutes", value: 430, sources: ["apple_health"] }];
  expect(planImport(s, [], []).sleepLogs).toEqual([{ date: "2026-06-01", minutes: 430, source: "apple_health" }]);
  const has: PracticeLog[] = [{ id: "p", log_date: "2026-06-01", practice_type: "sleep", duration_minutes: null, detail: "", notes: "", created_at: "" }];
  expect(planImport(s, [], has).sleepLogs).toHaveLength(0);
});

test("ignores metrics the app doesn't consume and zero values", () => {
  const s = [
    { date: "2026-06-01", metric: "steps", value: 9000, sources: ["apple_health"] },
    { date: "2026-06-01", metric: "active_minutes", value: 0, sources: ["strava"] },
  ];
  expect(planImport(s, [], [])).toEqual({ metricUpserts: [], sleepLogs: [] });
});
