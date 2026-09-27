/**
 * Readings over time: each biomarker a person has logged, the latest against their own earlier readings.
 *
 * The comparison is only ever with themselves. The app does not say whether a number is "normal": reference ranges depend on the
 * lab, the method, age and sex, and a reading is for a clinician to interpret. What it can do honestly is show the direction
 * of the person's own numbers and how old the last one is -- and refuse to compare two readings in different units.
 */
import type { BiomarkerLog } from "./types";
import { daysBetweenISO } from "../util/dates";

export interface ReadingPoint {
  day: string;
  value: number;
}

export interface MetricTrend {
  /** as the person named it, from the latest entry */
  metric: string;
  unit: string;
  /** oldest first, at most `MAX_POINTS` (the latest ones) */
  points: ReadingPoint[];
  /** how many readings of this metric there are in all, as of the day */
  count: number;
  latest: ReadingPoint;
  previous: ReadingPoint | null;
  /** latest minus previous, when the two are comparable (same unit) */
  change: number | null;
  direction: "higher" | "lower" | "unchanged" | null;
  /** days since the latest reading, as of the day */
  daysSince: number;
  /** the whole picture in one plain sentence, without a verdict */
  sentence: string;
}

export const MAX_POINTS = 8;

const tidy = (s: string) => s.trim().replace(/\s+/g, " ");
const norm = (s: string) => tidy(s).toLowerCase();
const round = (n: number) => Math.round(n * 100) / 100;
const num = (n: number) => String(round(n));

/** Newest first; two readings on one day are ordered by when they were entered. */
const newestFirst = (a: BiomarkerLog, b: BiomarkerLog) => (a.log_date !== b.log_date ? (a.log_date < b.log_date ? 1 : -1) : b.created_at.localeCompare(a.created_at));

export function trendsFrom(readings: BiomarkerLog[], asOf: string): MetricTrend[] {
  const byMetric = new Map<string, BiomarkerLog[]>();
  for (const r of readings) {
    if (r.log_date > asOf) continue;
    const key = norm(r.metric);
    byMetric.set(key, [...(byMetric.get(key) ?? []), r]);
  }

  const out: MetricTrend[] = [];
  for (const list of byMetric.values()) {
    const sorted = [...list].sort(newestFirst);
    const latest = sorted[0];
    const previous = sorted[1] ?? null;
    const unit = latest.unit.trim();
    const comparable = previous !== null && norm(previous.unit) === norm(latest.unit);
    const change = comparable ? round(latest.value - previous!.value) : null;
    const direction = change === null ? null : change === 0 ? "unchanged" : change > 0 ? "higher" : "lower";
    const daysSince = Math.max(0, daysBetweenISO(latest.log_date, asOf));
    // the points shown are the latest readings in the same unit as the latest one: a mix of units on one strip would mean nothing
    const points = sorted
      .filter((r) => norm(r.unit) === norm(latest.unit))
      .slice(0, MAX_POINTS)
      .reverse()
      .map((r) => ({ day: r.log_date, value: r.value }));

    const withUnit = (v: number) => `${num(v)}${unit ? ` ${unit}` : ""}`;
    let sentence = `${tidy(latest.metric)}: ${withUnit(latest.value)} on ${latest.log_date}`;
    if (previous === null) sentence += ". Your first reading -- a second one lets the app show which way your own numbers are moving.";
    else if (!comparable) sentence += `. Your earlier reading was in a different unit (${previous.unit.trim() || "none given"}), so the two are not compared.`;
    else if (direction === "unchanged") sentence += `, the same as ${previous!.log_date}.`;
    else sentence += `, ${direction} than your ${withUnit(previous!.value)} on ${previous!.log_date} (${change! > 0 ? "+" : ""}${num(change!)}).`;

    out.push({ metric: tidy(latest.metric), unit, points, count: sorted.length, latest: { day: latest.log_date, value: latest.value }, previous: previous ? { day: previous.log_date, value: previous.value } : null, change, direction, daysSince, sentence });
  }
  // most recently measured first
  return out.sort((a, b) => (a.latest.day < b.latest.day ? 1 : a.latest.day > b.latest.day ? -1 : a.metric.localeCompare(b.metric)));
}
