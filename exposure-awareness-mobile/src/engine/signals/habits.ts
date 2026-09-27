/**
 * Adding good ("resilience"). Sleep, movement, hydration and resets, each compared with the recommendation that fits
 * the person -- published guidelines where one exists (sleep hours by age, weekly activity minutes) and the app's own
 * habit rhythm where none does (hydration, resets), labelled as exactly that.
 *
 * Verified against the authorities' own pages and PubMed on 2026-09-25:
 *  - Activity: adults 150 minutes a week of moderate activity (Physical Activity Guidelines for Americans, 2nd ed., JAMA 2018,
 *    PMID 30418471; WHO 2020, Br J Sports Med, PMID 33239350); ages 6-17 an average of 60 minutes a day.
 *  - Sleep (CDC, "About sleep"): 6-12 years 9-12 hours; 13-17 years 8-10 hours; 18-60 years 7 or more; 61-64 years 7-9; 65 and over 7-8.
 *    (AASM/SRS adult consensus, Sleep 2015, PMID 26039963; AASM pediatric consensus, J Clin Sleep Med 2016, PMID 27250809.)
 *
 * A habit nobody has recorded is not scored as zero -- it simply has no evidence yet, and the signal says so.
 */
import type { CheckInLog } from "../types";
import type { ComparisonPart, ComparisonRead, Signal, SignalContext, SignalData, SignalResult } from "./types";
import { ageOf, clamp, decay, observedDays, perWeek } from "./decay";

export interface HabitTargets {
  exerciseMinPerWeek: number;
  exerciseSource: string;
  sleepMinPerNight: number;
  sleepSource: string;
}

export function habitTargets(ageYears: number | null): HabitTargets {
  const age = ageYears ?? 30;
  if (age <= 12) return { exerciseMinPerWeek: 420, exerciseSource: "US Physical Activity Guidelines and WHO: about 60 minutes a day", sleepMinPerNight: 540, sleepSource: "CDC: 9-12 hours a night (ages 6-12)" };
  if (age <= 17) return { exerciseMinPerWeek: 420, exerciseSource: "US Physical Activity Guidelines and WHO: about 60 minutes a day", sleepMinPerNight: 480, sleepSource: "CDC: 8-10 hours a night (ages 13-17)" };
  const exercise = { exerciseMinPerWeek: 150, exerciseSource: "US Physical Activity Guidelines and WHO: 150 minutes a week of moderate activity" };
  if (age <= 60) return { ...exercise, sleepMinPerNight: 420, sleepSource: "CDC: 7 or more hours a night (ages 18-60)" };
  if (age <= 64) return { ...exercise, sleepMinPerNight: 420, sleepSource: "CDC: 7-9 hours a night (ages 61-64)" };
  return { ...exercise, sleepMinPerNight: 420, sleepSource: "CDC: 7-8 hours a night (ages 65 and over)" };
}

const HYDRATION_DAYS_PER_WEEK = 5;
const RESET_DAYS_PER_WEEK = 3;
/**
 * Days a week of records at which each habit's reading is fully trustworthy. A habit with no records at all has no
 * evidence -- it is left out of the picture rather than scored as zero -- and one recorded now and then counts in
 * proportion.
 */
const FULL_DAYS = { sleep: 4, exercise: 2, hydration: 3, resets: 2 } as const;
const OMEGA = { sleep: 0.3, exercise: 0.3, hydration: 0.2, resets: 0.2 } as const;

interface Day {
  exercise: number;
  /** minutes of activity were recorded that day (a practice log, or the active-minutes number -- even a zero) */
  exerciseData: boolean;
  sleep: number | null;
  hydration: boolean;
  reset: boolean;
}

function byDay(data: SignalData): Map<string, Day> {
  const days = new Map<string, Day>();
  const get = (date: string) => {
    let d = days.get(date);
    if (!d) days.set(date, (d = { exercise: 0, exerciseData: false, sleep: null, hydration: false, reset: false }));
    return d;
  };
  for (const p of data.logs.practices) {
    const d = get(p.log_date);
    if (p.practice_type === "exercise") {
      d.exerciseData = true;
      d.exercise += p.duration_minutes ?? 0;
    } else if (p.practice_type === "sleep") {
      if (p.duration_minutes != null) d.sleep = Math.max(d.sleep ?? 0, p.duration_minutes);
    } else if (p.practice_type === "hydration") d.hydration = true;
    else if (p.practice_type === "grounding_stretching") d.reset = true;
  }
  for (const m of data.metrics) {
    if (m.active_minutes == null) continue;
    const d = get(m.log_date);
    d.exerciseData = true;
    d.exercise = Math.max(d.exercise, m.active_minutes);
  }
  return days;
}

const hours = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, "0")} min`;

function readOf(ratio: number, confidence: number): ComparisonRead {
  return confidence < 0.15 ? "not_enough_yet" : ratio >= 0.95 ? "on_target" : ratio >= 0.6 ? "close" : "room_to_grow";
}

/** A qualitative comparison with the person's own recent past: how the last week's check-ins felt against the week before. */
export function moodNote(checkins: CheckInLog[], asOf: string): string | null {
  const inWeek = (from: number, to: number) => checkins.filter((c) => c.mood !== null && ageOf(c.log_date, asOf) >= from && ageOf(c.log_date, asOf) <= to);
  const recent = inWeek(0, 6);
  if (recent.length < 3) return null;
  const good = (list: CheckInLog[]) => list.filter((c) => c.mood === "good").length;
  const before = inWeek(7, 13);
  const base = `Check-ins: ${good(recent)} of the last ${recent.length} felt good`;
  return before.length >= 3 ? `${base}, compared with ${good(before)} of the ${before.length} the week before.` : `${base}.`;
}

export const habitsSignal: Signal = {
  key: "resilience",
  label: "Adding good",
  blurb: "Sleep, movement, hydration and resets, each compared with the guideline that fits you (or a plain habit rhythm where none exists).",
  defaultWeight: 20,
  sources: ["practice_log", "daily_numbers", "checkin_log"],
  evaluate({ asOf, data }: SignalContext): SignalResult {
    const targets = habitTargets(data.profile?.ageYears ?? null);
    const observed = observedDays(data.firstActivityDay, asOf);

    let exercise = 0;
    let exerciseDataW = 0;
    let sleepNightsW = 0;
    let sleepDurW = 0;
    let sleepAttW = 0;
    let hydration = 0;
    let reset = 0;
    for (const [date, d] of byDay(data)) {
      const w = decay(ageOf(date, asOf));
      if (w === 0) continue;
      exercise += w * d.exercise;
      if (d.exerciseData) exerciseDataW += w;
      if (d.sleep != null) {
        sleepNightsW += w;
        sleepDurW += w * d.sleep;
        sleepAttW += w * Math.min(1, d.sleep / targets.sleepMinPerNight);
      }
      if (d.hydration) hydration += w;
      if (d.reset) reset += w;
    }

    const exercisePerWeek = perWeek(exercise, observed);
    const exerciseDataDays = perWeek(exerciseDataW, observed);
    const sleepNights = perWeek(sleepNightsW, observed);
    const hydrationDays = perWeek(hydration, observed);
    const resetDays = perWeek(reset, observed);
    const cover = (perWeekDays: number, full: number) => clamp(perWeekDays / full, 0, 1) || 0;

    const habits = [
      { key: "sleep" as const, att: sleepNightsW > 0 ? sleepAttW / sleepNightsW : 0, cov: cover(sleepNights, FULL_DAYS.sleep) },
      { key: "exercise" as const, att: Math.min(1, exercisePerWeek / targets.exerciseMinPerWeek), cov: cover(exerciseDataDays, FULL_DAYS.exercise) },
      { key: "hydration" as const, att: Math.min(1, hydrationDays / HYDRATION_DAYS_PER_WEEK), cov: cover(hydrationDays, FULL_DAYS.hydration) },
      { key: "resets" as const, att: Math.min(1, resetDays / RESET_DAYS_PER_WEEK), cov: cover(resetDays, FULL_DAYS.resets) },
    ];
    const seen = habits.reduce((sum, h) => sum + OMEGA[h.key] * h.cov, 0);
    const value = seen > 0 ? (habits.reduce((sum, h) => sum + OMEGA[h.key] * h.cov * h.att, 0) / seen) * 100 : 0;
    const confidence = seen;

    const at = Object.fromEntries(habits.map((h) => [h.key, h])) as Record<(typeof habits)[number]["key"], (typeof habits)[number]>;
    const parts: ComparisonPart[] = [
      {
        label: "Sleep",
        basis: "guideline",
        measured: sleepNightsW > 0 ? `${hours(sleepDurW / sleepNightsW)} on the nights you logged (about ${sleepNights.toFixed(1)} nights a week)` : "no sleep hours logged lately",
        against: targets.sleepSource,
        ratio: sleepNightsW > 0 ? at.sleep.att : null,
        read: readOf(at.sleep.att, at.sleep.cov),
      },
      {
        label: "Movement",
        basis: "guideline",
        measured: at.exercise.cov > 0 ? `${Math.round(exercisePerWeek)} minutes a week` : "no activity minutes recorded lately",
        against: targets.exerciseSource,
        ratio: at.exercise.cov > 0 ? at.exercise.att : null,
        read: readOf(at.exercise.att, at.exercise.cov),
      },
      {
        label: "Hydration",
        basis: "cadence",
        measured: at.hydration.cov > 0 ? `${hydrationDays.toFixed(1)} days a week logged` : "none logged lately",
        against: `the app's habit rhythm: ${HYDRATION_DAYS_PER_WEEK} days a week`,
        ratio: at.hydration.cov > 0 ? at.hydration.att : null,
        read: readOf(at.hydration.att, at.hydration.cov),
      },
      {
        label: "Resets",
        basis: "cadence",
        measured: at.resets.cov > 0 ? `${resetDays.toFixed(1)} days a week of stretching or grounding` : "none logged lately",
        against: `the app's habit rhythm: ${RESET_DAYS_PER_WEEK} days a week`,
        ratio: at.resets.cov > 0 ? at.resets.att : null,
        read: readOf(at.resets.att, at.resets.cov),
      },
    ];

    const notes = ["Recent weeks count more than older ones. A habit you haven't recorded is left out of the picture, not scored as zero."];
    const mood = moodNote(data.checkins.filter((c) => c.log_date <= asOf), asOf);
    if (mood) notes.push(mood);

    const counted = parts.filter((p) => p.read !== "not_enough_yet");
    const near = counted.filter((p) => p.read === "on_target" || p.read === "close").length;
    const summary = counted.length === 0 ? "No sleep, movement or reset records to compare yet." : `${near} of ${counted.length} habits are at or near their reference.`;

    return { key: "resilience", value, confidence, parts, summary, notes };
  },
};
