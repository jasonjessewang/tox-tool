/**
 * How the score remembers. A day's records count for less as it recedes: half as much every ten days, and not
 * at all after six weeks. Compared with hard week-long windows this means one quiet week nudges the picture
 * instead of erasing it, and a busy day fades gradually instead of falling off a cliff on the eighth morning.
 */
import { daysBetweenISO } from "../../util/dates";

export const HALF_LIFE_DAYS = 10;
export const HORIZON_DAYS = 42;
/** The score compares against the person's earlier self this many days back. */
export const BASELINE_DAYS = 28;

/** Weight of a record `ageDays` old (0 = today). */
export function decay(ageDays: number): number {
  if (ageDays < 0 || ageDays > HORIZON_DAYS) return 0;
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

/** Age of a day key relative to the day being evaluated. */
export const ageOf = (day: string, asOf: string) => daysBetweenISO(day, asOf);

/**
 * The total weight of a steady daily stream that has been running for `observedDays`. Dividing a decayed sum by this
 * turns it into a per-day average, so a person who has only been around for a few days is not judged as if the rest of
 * the window were empty.
 */
export function effectiveDays(observedDays: number): number {
  const n = Math.min(HORIZON_DAYS + 1, Math.max(1, Math.floor(observedDays)));
  let sum = 0;
  for (let a = 0; a < n; a++) sum += decay(a);
  return sum;
}

/** Days the person has been around as of `asOf` (1 on the first day), for `effectiveDays`. */
export function observedDays(firstActivityDay: string | null, asOf: string): number {
  if (firstActivityDay === null) return 0;
  const age = ageOf(firstActivityDay, asOf);
  return age < 0 ? 0 : age + 1;
}

/**
 * A decayed sum expressed per week. At least a week's worth of denominator is used, so three good days early on read as
 * "on pace", not as three weeks' worth.
 */
export function perWeek(decayedSum: number, observed: number): number {
  return (decayedSum / effectiveDays(Math.max(7, observed))) * 7;
}

export const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
