/**
 * Checked against your body. A biomarker -- a lab value, a resting heart rate, a blood-pressure reading -- is the one
 * input that is not self-reported, so it is what anchors the rest. The signal compares how recent your latest reading
 * is with a check-in about every three months, and (as words, never as a verdict) how your latest reading compares with
 * your own previous one. It does not judge the number: this app measures, it does not diagnose.
 */
import type { BiomarkerLog } from "../types";
import type { ComparisonRead, Signal, SignalContext, SignalResult } from "./types";
import { ageOf, clamp } from "./decay";
import { msg, tr, trn } from "../../i18n";

export const CADENCE_DAYS = 90;
export const STALE_DAYS = 270;

/** Readings in the last year that make the picture fully trustworthy: one anchors it, two let it be compared with itself. */
export const evidenceFrom = (readings: number) => 1 - Math.pow(0.5, readings);

/** 100 for a reading within the quarter, easing to 20 by nine months; a person who has never logged one has no evidence, not a zero. */
export function freshnessValue(daysSince: number): number {
  return clamp(100 - (80 * Math.max(0, daysSince - CADENCE_DAYS)) / (STALE_DAYS - CADENCE_DAYS), 20, 100);
}

/** How the latest reading of a metric compares with the one before it, in words. */
export function changeNote(readings: BiomarkerLog[]): string | null {
  const byMetric = new Map<string, BiomarkerLog[]>();
  for (const b of readings) {
    const key = b.metric.trim().toLowerCase();
    byMetric.set(key, [...(byMetric.get(key) ?? []), b]);
  }
  let best: { latest: BiomarkerLog; previous: BiomarkerLog } | null = null;
  for (const list of byMetric.values()) {
    const sorted = [...list].sort((a, b) => (a.log_date < b.log_date ? 1 : a.log_date > b.log_date ? -1 : b.created_at.localeCompare(a.created_at)));
    if (sorted.length < 2) continue;
    if (!best || sorted[0].log_date > best.latest.log_date) best = { latest: sorted[0], previous: sorted[1] };
  }
  if (!best) return null;
  const { latest, previous } = best;
  const vars = { metric: tr(latest.metric), before: previous.value, after: latest.value, unit: tr(latest.unit), from: previous.log_date, to: latest.log_date };
  return latest.value === previous.value
    ? tr("{metric}: {before} -> {after} {unit} ({from} to {to}) -- unchanged from your own previous reading; a comparison with yourself, not a verdict.", vars)
    : latest.value > previous.value
      ? tr("{metric}: {before} -> {after} {unit} ({from} to {to}) -- higher than your own previous reading; a comparison with yourself, not a verdict.", vars)
      : tr("{metric}: {before} -> {after} {unit} ({from} to {to}) -- lower than your own previous reading; a comparison with yourself, not a verdict.", vars);
}

export const validationSignal: Signal = {
  key: "validation",
  label: msg("Checked against your body"),
  blurb: msg("How recent your last biomarker is, against a check-in about every three months."),
  valueMeans: msg("how up to date your readings are, not what they show"),
  defaultWeight: 10,
  sources: ["biomarker_log"],
  evaluate({ asOf, data }: SignalContext): SignalResult {
    const known = data.biomarkers.filter((b) => b.log_date <= asOf);
    const lastYear = known.filter((b) => ageOf(b.log_date, asOf) <= 365).length;
    const latest = known.reduce<BiomarkerLog | null>((a, b) => (a === null || b.log_date > a.log_date ? b : a), null);
    if (!latest) {
      return {
        key: "validation",
        value: 0,
        confidence: 0,
        parts: [{ label: tr("Latest biomarker"), basis: "cadence", measured: tr("none logged yet"), against: tr("a check-in about every 3 months"), ratio: null, read: "not_enough_yet" }],
        summary: tr("No biomarker logged yet."),
        notes: [tr("One real reading from your own body -- a lab result, resting heart rate, blood pressure -- anchors everything else.")],
      };
    }
    const days = Math.max(0, ageOf(latest.log_date, asOf));
    const value = freshnessValue(days);
    const read: ComparisonRead = days <= CADENCE_DAYS ? "on_target" : days <= 180 ? "close" : "room_to_grow";
    const notes: string[] = [];
    const change = changeNote(known);
    if (change) notes.push(change);
    if (days > CADENCE_DAYS) notes.push(tr("A fresh reading brings this back up; a check-in every few months keeps your picture current."));
    return {
      key: "validation",
      value,
      confidence: evidenceFrom(Math.max(1, lastYear)),
      parts: [{ label: tr("Latest biomarker"), basis: "cadence", measured: days === 0 ? tr("logged today") : trn(days, "{n} day ago", "{n} days ago"), against: tr("a check-in about every 3 months (90 days)"), ratio: value / 100, read }],
      summary: days <= CADENCE_DAYS ? tr("Your latest reading is within the last quarter.") : tr("Your latest reading is {n} days old.", { n: days }),
      notes,
    };
  },
};
