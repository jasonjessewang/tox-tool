// i18n-ignore-file: test fixtures, not imported by the app
/**
 * Builds SignalData from a few plain lines, so the signals can be tested (and the score explored) without storage.
 * Not imported by the app.
 */
import { loadHazardDb } from "../scoring";
import { LESSONS, curriculumRef } from "../../data/curriculum";
import { checkRef } from "../learningChecks";
import type { Frequency, ProductKind, ShelfItem } from "../ingredients/types";
import type { Occupant, Place, PlaceKind } from "../places/types";
import type { UserProfile } from "../types";
import { assessShelf, firstDay, tallyByDay } from "./context";
import type { SignalData } from "./types";

export interface Fixture {
  meals?: { day: string; text: string; nova?: 1 | 2 | 3 | 4 | null; notes?: string }[];
  productLogs?: { day: string; name: string; ingredients: string }[];
  air?: { day: string; value: number }[];
  practices?: { day: string; type: "sleep" | "hydration" | "exercise" | "grounding_stretching" | "screen_free" | "fasting" | "other"; minutes?: number | null }[];
  metrics?: { day: string; activeMinutes?: number | null }[];
  checkins?: { day: string; mood: "good" | "okay" | "rough" | null }[];
  biomarkers?: { day: string; metric: string; value: number; unit?: string }[];
  lessons?: { day: string; index: number }[];
  /** answers to the concept-check questions, oldest first: the question id and whether it was answered right */
  checks?: { day: string; id: string; correct: boolean }[];
  shelf?: { name: string; ingredients: string; frequency?: Frequency; kind?: ProductKind; addedDay: string; removedDay?: string | null; nova?: 1 | 2 | 3 | 4 | null }[];
  places?: {
    kind: PlaceKind;
    label?: string;
    hours?: number | null;
    occupants?: Partial<Occupant>[];
    /** one entry per answer given: the check, the option value, the day */
    answers?: { check: string; value: string; day: string }[];
  }[];
  profile?: Partial<UserProfile> | null;
}

const noon = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
};

export const baseProfile: UserProfile = {
  ageYears: 34, sex: "unspecified", weightKg: 70, heightCm: 170, pregnant: false, breastfeeding: false, conditions: [],
  contentComplexity: "balanced", completedAt: "2026-01-01T00:00:00.000Z", locationEnabled: false, checkInTime: "off",
};

export function makeData(f: Fixture = {}): SignalData {
  const created_at = "2026-01-01T00:00:00.000Z";
  let n = 0;
  const id = () => `t${n++}`;
  const substances = loadHazardDb();
  const profile = f.profile === null ? null : { ...baseProfile, ...(f.profile ?? {}) };

  const shelf: ShelfItem[] = (f.shelf ?? []).map((s) => ({
    id: id(), addedAt: noon(s.addedDay), removedAt: s.removedDay ? noon(s.removedDay) : null, name: s.name, brand: "", kind: s.kind ?? "personal_care",
    barcode: null, source: "text", ingredientsText: s.ingredients, nova: s.nova ?? null, nutrition: null, frequency: s.frequency ?? "daily", servingsPerUse: 1,
  }));

  const logs = {
    food: (f.meals ?? []).map((m) => ({ id: id(), log_date: m.day, meal: "lunch" as const, food_item: m.text, processing_level: m.nova ?? null, notes: m.notes ?? "", created_at })),
    products: (f.productLogs ?? []).map((p) => ({ id: id(), log_date: p.day, product_type: "care", product_name: p.name, ingredients_text: p.ingredients, notes: "", created_at })),
    environment: [],
    air_quality: (f.air ?? []).map((a) => ({ id: id(), log_date: a.day, location: "Home", pollutant: "PM2.5" as const, value: a.value, source: "manual", notes: "", created_at })),
    practices: (f.practices ?? []).map((p) => ({ id: id(), log_date: p.day, practice_type: p.type, duration_minutes: p.minutes ?? null, detail: "", notes: "", created_at })),
  };
  const metrics = (f.metrics ?? []).map((m) => ({ id: id(), log_date: m.day, calories: null, active_minutes: m.activeMinutes ?? null, screen_hours: null, created_at }));
  const checkins = (f.checkins ?? []).map((c) => ({ id: id(), log_date: c.day, mood: c.mood, reflection: "", planForTomorrow: "", created_at }));
  const biomarkers = (f.biomarkers ?? []).map((b) => ({ id: id(), log_date: b.day, metric: b.metric, value: b.value, unit: b.unit ?? "", source: "", notes: "", created_at }));
  // as storage keeps them: newest first
  const learning = [
    ...(f.lessons ?? []).map((l) => ({ ref: curriculumRef(LESSONS[l.index].id), date: l.day })),
    ...(f.checks ?? []).map((c) => ({ ref: checkRef(c.id, c.correct), date: c.day })),
  ]
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.date === b.e.date ? a.i - b.i : a.e.date < b.e.date ? -1 : 1))
    .map((x) => x.e)
    .reverse();

  const places: Place[] = (f.places ?? []).map((p) => {
    const answers: Place["answers"] = {};
    for (const a of p.answers ?? []) (answers[a.check] ??= []).push({ value: a.value, day: a.day });
    for (const list of Object.values(answers)) list.sort((x, y) => (x.day < y.day ? -1 : 1));
    return {
      id: id(), kind: p.kind, label: p.label ?? { home: "Home", work: "Work", daily: "Everyday places" }[p.kind], hoursPerWeek: p.hours ?? null,
      occupants: (p.occupants ?? []).map((o, i) => ({ id: `o${i}`, label: "Someone", ageYears: null, pregnant: false, conditions: [], isPet: false, ...o })),
      answers, updatedAt: created_at,
    };
  });

  const parts = { logs, metrics, biomarkers, checkins, learning, shelf, places };
  return { ...parts, shelfAssessments: assessShelf(shelf, profile, substances), days: tallyByDay(logs, substances), firstActivityDay: firstDay(parts), substances, profile };
}

/** `count` consecutive days ending `endDay`, oldest first. */
export function daysEnding(endDay: string, count: number): string[] {
  const [y, m, d] = endDay.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const t = new Date(y, m - 1, d - (count - 1 - i), 12);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  });
}
