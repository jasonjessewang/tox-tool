/**
 * Calendar-day helpers. A day key ("2026-09-25") is the user's LOCAL calendar day.
 *
 * `new Date().toISOString().slice(0, 10)` is the UTC day instead. For anyone outside UTC that is
 * the wrong day for part of every day -- 8 pm in Chicago is already tomorrow in UTC, 7 am in Seoul
 * is still yesterday -- so entries landed on a neighbouring date and "today", the streak and the
 * weekly rollups disagreed with the person's own calendar. (The engine soak run measured it: 70%
 * of an evening logger's entries in Chicago were stamped a day late.) Everything that creates or
 * compares a day key goes through here.
 *
 * Full instants (created_at, addedAt) stay ISO/UTC strings; only day keys use these helpers.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** The local calendar day of an instant, as YYYY-MM-DD. */
export function localISODate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's local calendar day. */
export function todayISO(now: Date = new Date()): string {
  return localISODate(now);
}

/** The local calendar day n days before `now`. Calendar arithmetic anchored at noon, so a DST shift never moves it. */
export function daysAgoISO(n: number, now: Date = new Date()): string {
  return localISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n, 12));
}

/** The last moment of a local calendar day, as an instant -- for asking "was this active at the end of that day?". */
export function endOfDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

/** Whole calendar days from one day key to another (negative when `to` is earlier). */
export function daysBetweenISO(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}
