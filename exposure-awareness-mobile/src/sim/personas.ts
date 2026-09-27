/**
 * Four simulated users, chosen so the engine meets different lives rather than four
 * variations of one: age 18 to 55, four timezones (which matters -- see the day-boundary
 * findings), different diets and product habits, different levels of persistence, and one
 * pregnancy with asthma to exercise the personalization branches.
 *
 * These are behavior models, not medical claims: they exist to see how the engine's outputs
 * evolve when a plausible person keeps using it (and sometimes stops).
 */
import type { UserProfile } from "../engine/types";
import type { Occupant, PlaceKind } from "../engine/places/types";
import type { MealSlot } from "./catalog";

/** One place in a persona's life, as they would describe it to the app. */
export interface PlacePlan {
  kind: PlaceKind;
  label: string;
  hours?: number;
  /** People who share it; `joinDay` is when someone arrives after the person has already started answering. */
  occupants?: (Partial<Occupant> & { label: string; joinDay?: number })[];
  /** What is actually true there: check id -> option value. A check that is missing is one the person can't answer. */
  truth: Record<string, string>;
  /** What becomes true if they act on the advice about it (only for things a person can actually change). */
  fix?: Record<string, string>;
}

export interface BiomarkerEvent {
  day: number;
  metric: string;
  unit: string;
  value: number;
  source: string;
}

export interface Persona {
  id: string;
  label: string;
  blurb: string;
  /** IANA zone. The process must be started with TZ set to this (Jest hides runtime TZ changes). */
  tz: string;
  profile: UserProfile;
  /** Minutes after local midnight at which each thing usually happens. */
  schedule: Record<MealSlot | "practice" | "checkIn" | "numbers" | "learn" | "review", number>;
  /** Some days the routine slides later (night shifts, late dinners). */
  lateShift?: { prob: number; minutes: number };
  engage: {
    base: number;
    floor: number;
    halfLifeDays: number;
    weekendFactor: number;
    disruptions: { from: number; to: number; factor: number; why: string }[];
  };
  /** P(a meal that was actually eaten gets logged | the person is engaged today). */
  thorough: number;
  skipBreakfast: number;
  novaLabelProb: number;
  habits: {
    sleepMean: number;
    sleepSd: number;
    sleepLogProb: number;
    hydrationProb: number;
    exerciseProb: number;
    exerciseMinutes: [number, number];
    screenFreeProb: number;
  };
  checkInProb: number;
  learnProb: number;
  /** the questions that follow the lessons: how much of it this person does, and how well it goes */
  recall: {
    /** the chance they try a lesson's questions right after reading it */
    inlineProb: number;
    /** the chance, on an engaged day, they answer the day's question in the Daily flow */
    dailyProb: number;
    /** the chance, on an engaged day, they open the review in the Engine and take up to three more */
    reviewProb: number;
    /** how often a question is right the first time it is seen, and how much each earlier look at it adds */
    accuracy: number;
    gain: number;
  };
  questProb: number;
  adoptEagerness: number;
  reviewDow: number;
  scanPlan: string[];
  scanPool: string[];
  scanEveryDays: number;
  biomarkers: BiomarkerEvent[];
  air: { place: string; pmMean: number; pmSd: number; logProb: number; episodes?: { from: number; to: number; mean: number; sd: number }[] };
  numbers: { calories: [number, number]; active: [number, number]; screen: [number, number]; prob: number };
  places: {
    /** first day they open Places, the chance they do on an engaged day after that, and how many questions they answer per visit */
    startDay: number;
    visitProb: number;
    perVisit: number;
    plans: PlacePlan[];
  };
}

const profile = (p: Partial<UserProfile> & Pick<UserProfile, "ageYears" | "sex" | "weightKg" | "heightCm">): UserProfile => ({
  pregnant: false,
  breastfeeding: false,
  conditions: [],
  contentComplexity: "balanced",
  completedAt: "2026-07-04T00:00:00.000Z",
  locationEnabled: false,
  checkInTime: "off",
  ...p,
});

export const PERSONAS: Persona[] = [
  {
    id: "mina",
    label: "Mina, 18 -- first-year university student, Seoul",
    blurb: "Dorm and convenience-store meals, K-beauty routine, heavy screen time. Enthusiastic at first, exam weeks knock her off.",
    tz: "Asia/Seoul",
    profile: profile({ ageYears: 18, sex: "female", weightKg: 52, heightCm: 163, contentComplexity: "simple", checkInTime: "dinner" }),
    schedule: { breakfast: 470, lunch: 760, dinner: 1110, snack: 1320, practice: 1230, checkIn: 1290, numbers: 1300, learn: 1250, review: 1200 },
    engage: {
      base: 0.78, floor: 0.3, halfLifeDays: 28, weekendFactor: 0.9,
      disruptions: [
        { from: 40, to: 47, factor: 0.25, why: "midterms" },
        { from: 78, to: 83, factor: 0.3, why: "finals" },
      ],
    },
    thorough: 0.65, skipBreakfast: 0.45, novaLabelProb: 0.25,
    habits: { sleepMean: 400, sleepSd: 60, sleepLogProb: 0.5, hydrationProb: 0.4, exerciseProb: 0.25, exerciseMinutes: [30, 60], screenFreeProb: 0.05 },
    checkInProb: 0.55, learnProb: 0.35, questProb: 0.2, adoptEagerness: 1.0, reviewDow: 0,
    recall: { inlineProb: 0.6, dailyProb: 0.5, reviewProb: 0.15, accuracy: 0.6, gain: 0.1 },
    scanPlan: ["ramen_cup", "energy_drink", "triangle_kimbap", "shampoo_std", "toner_kbeauty", "sheet_mask", "body_wash", "lip_balm"],
    scanPool: ["granola_bar", "kombucha", "hand_soap_std"],
    scanEveryDays: 14,
    biomarkers: [
      { day: 20, metric: "Resting heart rate", unit: "bpm", value: 72, source: "wearable" },
      { day: 60, metric: "Resting heart rate", unit: "bpm", value: 70, source: "wearable" },
    ],
    air: { place: "Seoul", pmMean: 22, pmSd: 10, logProb: 0.08 },
    numbers: { calories: [1600, 2200], active: [20, 70], screen: [6, 11], prob: 0.5 },
    places: {
      startDay: 5, visitProb: 0.3, perVisit: 3,
      plans: [
        {
          kind: "home", label: "Dorm room", hours: 110,
          truth: { home_radon: "unsure", home_lead: "new", home_gas: "electric", home_moisture: "fixed", home_humidity: "low", home_filter: "none", home_scents: "daily", home_laundry: "regular", home_voc: "none", home_dust: "one", home_lawn: "no", home_nonstick: "no", home_smoke: "no", home_drycleaning: "rare" },
          fix: { home_scents: "rare", home_laundry: "some", home_humidity: "ok", home_dust: "both" },
        },
        { kind: "work", label: "Campus lecture halls", hours: 25, truth: { work_air: "stuffy", work_filters: "unsure", work_new: "none", work_moisture: "none", work_ground: "no" } },
        {
          kind: "daily", label: "Subway commute", hours: 6,
          truth: { daily_traffic: "some", daily_smoke_days: "no", daily_bottles: "bottles" },
          fix: { daily_smoke_days: "yes", daily_bottles: "good" },
        },
      ],
    },
  },
  {
    id: "marcus",
    label: "Marcus, 35 -- hospital nurse on rotating shifts, Houston",
    blurb: "Long shifts, takeout and vending-machine food, gas stove and an older house. Starts strong, decays fast; logs in the evening.",
    tz: "America/Chicago",
    profile: profile({ ageYears: 35, sex: "male", weightKg: 92, heightCm: 180 }),
    schedule: { breakfast: 480, lunch: 780, dinner: 1170, snack: 1290, practice: 1230, checkIn: 0, numbers: 1300, learn: 1330, review: 1260 },
    lateShift: { prob: 0.4, minutes: 150 },
    engage: {
      base: 0.85, floor: 0.2, halfLifeDays: 18, weekendFactor: 0.8,
      disruptions: [{ from: 30, to: 36, factor: 0.1, why: "flu week" }],
    },
    thorough: 0.5, skipBreakfast: 0.2, novaLabelProb: 0.1,
    habits: { sleepMean: 380, sleepSd: 90, sleepLogProb: 0.4, hydrationProb: 0.3, exerciseProb: 0.2, exerciseMinutes: [30, 45], screenFreeProb: 0.03 },
    checkInProb: 0.1, learnProb: 0.15, questProb: 0.15, adoptEagerness: 0.6, reviewDow: 3,
    recall: { inlineProb: 0.2, dailyProb: 0.1, reviewProb: 0, accuracy: 0.5, gain: 0.08 },
    scanPlan: ["cereal_sweet", "canned_chili", "hot_dogs", "soda_cola", "mouthwash_tcs", "deodorant_al", "body_wash"],
    scanPool: ["energy_drink", "granola_bar"],
    scanEveryDays: 20,
    biomarkers: [
      { day: 25, metric: "Blood pressure (systolic)", unit: "mmHg", value: 134, source: "clinic" },
      { day: 25, metric: "Vitamin D", unit: "ng/mL", value: 19, source: "lab" },
      { day: 80, metric: "Blood pressure (systolic)", unit: "mmHg", value: 131, source: "clinic" },
    ],
    air: { place: "Houston", pmMean: 11, pmSd: 5, logProb: 0.03 },
    numbers: { calories: [1900, 3100], active: [10, 60], screen: [3, 6], prob: 0.3 },
    places: {
      startDay: 12, visitProb: 0.2, perVisit: 4,
      plans: [
        {
          kind: "home", label: "The house", hours: 90,
          occupants: [{ label: "Dana", ageYears: 34 }, { label: "Theo", ageYears: 4 }, { label: "Rex", isPet: true }, { label: "Mom", ageYears: 68, joinDay: 45 }],
          truth: { home_radon: "never", home_lead: "old", home_gas: "gas_none", home_moisture: "slow", home_humidity: "high", home_filter: "old", home_scents: "some", home_laundry: "regular", home_voc: "fresh", home_dust: "one", home_lawn: "regular", home_nonstick: "hot", home_smoke: "no", home_drycleaning: "rare" },
          fix: { home_gas: "gas_vented", home_moisture: "fixed", home_humidity: "ok", home_filter: "recent", home_radon: "low", home_lead: "checked", home_lawn: "some", home_voc: "aired", home_nonstick: "careful" },
        },
        { kind: "work", label: "The hospital", hours: 48, truth: { work_air: "dry", work_filters: "yes", work_new: "aired", work_moisture: "fixed", work_ground: "tested" } },
        {
          kind: "daily", label: "Commute and errands", hours: 10,
          truth: { daily_traffic: "lots", daily_smoke_days: "rare", daily_bottles: "both" },
          fix: { daily_bottles: "good", daily_traffic: "steps" },
        },
      ],
    },
  },
  {
    id: "elena",
    label: "Elena, 55 -- school principal preparing to retire, Madrid",
    blurb: "Mediterranean diet, steady habits, invests in her health ahead of retirement. High persistence, travels for a week.",
    tz: "Europe/Madrid",
    profile: profile({ ageYears: 55, sex: "female", weightKg: 68, heightCm: 165, contentComplexity: "technical", checkInTime: "morning" }),
    schedule: { breakfast: 480, lunch: 870, dinner: 1290, snack: 1050, practice: 1140, checkIn: 1335, numbers: 1340, learn: 1320, review: 1260 },
    engage: {
      base: 0.92, floor: 0.65, halfLifeDays: 60, weekendFactor: 1.0,
      disruptions: [{ from: 50, to: 56, factor: 0.05, why: "travel" }],
    },
    thorough: 0.9, skipBreakfast: 0.05, novaLabelProb: 0.5,
    habits: { sleepMean: 440, sleepSd: 40, sleepLogProb: 0.7, hydrationProb: 0.7, exerciseProb: 0.55, exerciseMinutes: [45, 60], screenFreeProb: 0.15 },
    checkInProb: 0.8, learnProb: 0.6, questProb: 0.4, adoptEagerness: 1.0, reviewDow: 6,
    recall: { inlineProb: 0.8, dailyProb: 0.7, reviewProb: 0.3, accuracy: 0.68, gain: 0.1 },
    scanPlan: ["olive_oil", "tuna_can", "bread_whole", "yogurt_plain", "sunscreen", "lotion_pf", "deodorant_nat"],
    scanPool: ["canned_tomatoes", "shampoo_std", "hand_soap_plain"],
    scanEveryDays: 10,
    biomarkers: [
      { day: 10, metric: "Blood pressure (systolic)", unit: "mmHg", value: 128, source: "clinic" },
      { day: 12, metric: "Vitamin D", unit: "ng/mL", value: 34, source: "lab" },
      { day: 70, metric: "HbA1c", unit: "%", value: 5.6, source: "lab" },
      { day: 70, metric: "Blood pressure (systolic)", unit: "mmHg", value: 124, source: "clinic" },
    ],
    air: { place: "Madrid", pmMean: 14, pmSd: 6, logProb: 0.1 },
    numbers: { calories: [1700, 2200], active: [40, 90], screen: [2, 4], prob: 0.6 },
    places: {
      startDay: 3, visitProb: 0.5, perVisit: 5,
      plans: [
        {
          kind: "home", label: "The flat", hours: 100,
          occupants: [{ label: "Luis", ageYears: 58 }],
          truth: { home_radon: "low", home_lead: "checked", home_gas: "gas_vented", home_moisture: "none", home_humidity: "ok", home_filter: "none", home_scents: "rare", home_laundry: "free", home_voc: "aired", home_dust: "one", home_lawn: "no", home_nonstick: "careful", home_smoke: "no", home_drycleaning: "aired" },
          fix: { home_dust: "both" },
        },
        {
          kind: "work", label: "The school", hours: 45,
          truth: { work_air: "stuffy", work_filters: "no", work_new: "fresh", work_moisture: "ongoing", work_ground: "untested" },
          fix: { work_filters: "yes", work_moisture: "fixed", work_ground: "tested", work_new: "aired" },
        },
        { kind: "daily", label: "Daily walks and the metro", hours: 6, truth: { daily_traffic: "some", daily_smoke_days: "rare", daily_bottles: "good" }, fix: { daily_traffic: "steps" } },
      ],
    },
  },
  {
    id: "priya",
    label: "Priya, 31 -- software engineer, 20 weeks pregnant with asthma, San Francisco",
    blurb: "Highly motivated by the pregnancy, scans many personal-care products, wildfire-smoke week in the middle of the run.",
    tz: "America/Los_Angeles",
    profile: profile({ ageYears: 31, sex: "female", weightKg: 64, heightCm: 168, pregnant: true, conditions: ["asthma"], checkInTime: "dinner" }),
    schedule: { breakfast: 465, lunch: 750, dinner: 1125, snack: 930, practice: 1080, checkIn: 1260, numbers: 1275, learn: 1290, review: 1200 },
    engage: {
      base: 0.7, floor: 0.35, halfLifeDays: 35, weekendFactor: 0.85,
      disruptions: [{ from: 60, to: 63, factor: 0.1, why: "work trip" }],
    },
    thorough: 0.7, skipBreakfast: 0.1, novaLabelProb: 0.3,
    habits: { sleepMean: 470, sleepSd: 45, sleepLogProb: 0.6, hydrationProb: 0.7, exerciseProb: 0.45, exerciseMinutes: [30, 45], screenFreeProb: 0.1 },
    checkInProb: 0.5, learnProb: 0.45, questProb: 0.3, adoptEagerness: 1.2, reviewDow: 6,
    recall: { inlineProb: 0.5, dailyProb: 0.5, reviewProb: 0.2, accuracy: 0.62, gain: 0.1 },
    scanPlan: ["granola_bar", "canned_tomatoes", "kombucha", "retinol_serum", "shampoo_std", "lip_balm", "hand_soap_std", "sunscreen", "lotion_pf"],
    scanPool: ["yogurt_plain", "body_wash", "deodorant_nat"],
    scanEveryDays: 9,
    biomarkers: [
      { day: 15, metric: "Vitamin D", unit: "ng/mL", value: 28, source: "lab" },
      { day: 55, metric: "Resting heart rate", unit: "bpm", value: 84, source: "wearable" },
    ],
    air: { place: "San Francisco", pmMean: 8, pmSd: 5, logProb: 0.2, episodes: [{ from: 40, to: 44, mean: 95, sd: 30 }] },
    numbers: { calories: [1900, 2500], active: [30, 60], screen: [7, 10], prob: 0.5 },
    places: {
      startDay: 2, visitProb: 0.5, perVisit: 4,
      plans: [
        {
          kind: "home", label: "The apartment", hours: 100,
          occupants: [{ label: "Sam", ageYears: 33 }, { label: "Miso", isPet: true }],
          truth: { home_radon: "unsure", home_lead: "old", home_gas: "gas_some", home_moisture: "fixed", home_humidity: "unsure", home_filter: "mid", home_scents: "some", home_laundry: "some", home_voc: "fresh", home_dust: "one", home_lawn: "no", home_nonstick: "careful", home_smoke: "no", home_drycleaning: "rare" },
          fix: { home_gas: "gas_vented", home_voc: "aired", home_scents: "rare", home_laundry: "free", home_lead: "checked", home_dust: "both", home_filter: "recent" },
        },
        { kind: "work", label: "The office", hours: 30, truth: { work_air: "ok", work_filters: "unsure", work_new: "none", work_moisture: "none", work_ground: "no" } },
        {
          kind: "daily", label: "Commute and walks", hours: 5,
          truth: { daily_traffic: "some", daily_smoke_days: "yes", daily_bottles: "good" },
        },
      ],
    },
  },
];

export const personaById = (id: string) => PERSONAS.find((p) => p.id === id);
