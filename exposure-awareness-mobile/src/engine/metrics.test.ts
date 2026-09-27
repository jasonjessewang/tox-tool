import { summarizeMetric } from "./metrics";
import type { DailyMetricLog, PracticeLog } from "./types";
import { localISODate } from "../util/dates";

// Local noon and local-calendar day keys, so the fixtures mean the same thing in every timezone.
const now = new Date(2026, 5, 15, 12);
const day = (n: number) => localISODate(new Date(2026, 5, 15 - n, 12));
const m = (n: number, over: Partial<DailyMetricLog>): DailyMetricLog => ({
  id: String(n), log_date: day(n), calories: null, active_minutes: null, screen_hours: null, created_at: "", ...over,
});

test("returns 7 days oldest-to-newest ending today, null where nothing logged", () => {
  const s = summarizeMetric("calories", [m(0, { calories: 2000 })], [], now);
  expect(s.days).toHaveLength(7);
  expect(s.days[6].date).toBe(day(0));
  expect(s.days[6].value).toBe(2000);
  expect(s.days[0].value).toBe(null);
});

test("week-over-week change compares averages of logged days only", () => {
  const logs = [m(0, { screen_hours: 4 }), m(1, { screen_hours: 4 }), m(7, { screen_hours: 8 }), m(8, { screen_hours: 8 })];
  const s = summarizeMetric("screen_hours", logs, [], now);
  expect(s.thisWeekAvg).toBe(4);
  expect(s.prevWeekAvg).toBe(8);
  expect(s.changePct).toBe(-50);
});

test("no prior week data means no fabricated change percentage", () => {
  const s = summarizeMetric("calories", [m(0, { calories: 2000 })], [], now);
  expect(s.changePct).toBe(null);
});

test("active minutes falls back to logged exercise/stretching practice minutes", () => {
  const practices: PracticeLog[] = [
    { id: "p", log_date: day(0), practice_type: "exercise", duration_minutes: 30, detail: "", notes: "", created_at: "" },
    { id: "q", log_date: day(0), practice_type: "sleep", duration_minutes: 450, detail: "", notes: "", created_at: "" },
  ];
  expect(summarizeMetric("active_minutes", [], practices, now).days[6].value).toBe(30);
});

test("an explicit entry wins over the practice fallback", () => {
  const practices: PracticeLog[] = [
    { id: "p", log_date: day(0), practice_type: "exercise", duration_minutes: 30, detail: "", notes: "", created_at: "" },
  ];
  expect(summarizeMetric("active_minutes", [m(0, { active_minutes: 45 })], practices, now).days[6].value).toBe(45);
});
