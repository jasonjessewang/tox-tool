import { buildWeekLog } from "./weekLog";
import type { LogStore } from "./types";
import { localISODate } from "../util/dates";

// Local noon and local-calendar day keys, so the fixtures mean the same thing in every timezone.
const now = new Date(2026, 5, 15, 12);
const day = (n: number) => localISODate(new Date(2026, 5, 15 - n, 12));
const empty: LogStore = { food: [], products: [], environment: [], air_quality: [], practices: [] };

test("always seven days, oldest first, last is today", () => {
  const w = buildWeekLog({ logs: empty, checkins: [], metrics: [], actions: [] }, now);
  expect(w.days).toHaveLength(7);
  expect(w.days[0].date).toBe(day(6));
  expect(w.days[6].isToday).toBe(true);
  expect(w.totals.daysActive).toBe(0);
});

test("aggregates practices (deduped per day), actions, check-ins and numbers per day", () => {
  const logs: LogStore = {
    ...empty,
    practices: [
      { id: "1", log_date: day(1), practice_type: "sleep", duration_minutes: null, detail: "", notes: "", created_at: "" },
      { id: "2", log_date: day(1), practice_type: "sleep", duration_minutes: null, detail: "", notes: "", created_at: "" },
      { id: "3", log_date: day(1), practice_type: "hydration", duration_minutes: null, detail: "", notes: "", created_at: "" },
    ],
  };
  const w = buildWeekLog(
    {
      logs,
      checkins: [{ id: "c", log_date: day(1), mood: "good", reflection: "", planForTomorrow: "", created_at: "" }],
      metrics: [{ id: "m", log_date: day(1), calories: 2000, active_minutes: null, screen_hours: 3, created_at: "" }],
      actions: [{ completed_date: day(1) }, { completed_date: day(1) }],
    },
    now
  );
  const d = w.days[5];
  expect(d.practices).toEqual(["Sleep", "Hydration"]);
  expect(d.actions).toBe(2);
  expect(d.mood).toBe("good");
  expect(d.calories).toBe(2000);
  expect(d.activeMinutes).toBe(null);
  expect(w.totals).toEqual({ checkIns: 1, practices: 2, actions: 2, daysActive: 1 });
});

test("a scan catalogs a product: it is not counted as a meal, but it is a day the person was here", () => {
  const scanned = { notes: "Scanned label.", created_at: "" };
  const logs: LogStore = {
    ...empty,
    food: [
      { id: "f1", log_date: day(0), meal: "breakfast", food_item: "porridge", processing_level: null, notes: "", created_at: "" },
      { id: "f2", log_date: day(0), meal: "snack", food_item: "Nutella", processing_level: 4, ...scanned },
      { id: "f3", log_date: day(2), meal: "snack", food_item: "Granola bar", processing_level: 4, ...scanned },
    ],
    products: [{ id: "p1", log_date: day(2), product_type: "scanned", product_name: "Shampoo", ingredients_text: "", ...scanned }],
  };
  const w = buildWeekLog({ logs, checkins: [], metrics: [], actions: [] }, now);
  expect(w.days[6].meals).toBe(1);
  expect(w.days[6].scans).toBe(1);
  expect(w.days[4].meals).toBe(0);
  expect(w.days[4].scans).toBe(2);
  expect(w.days[4].hasAnything).toBe(true);
  expect(w.totals.daysActive).toBe(2);
});
