/**
 * Longitudinal simulation: a persona uses the app day by day for weeks, writing exactly what
 * the screens write, through the REAL storage layer, and the REAL engine entry points are
 * read after each day. The persona also reacts to the engine's own recommendations, so the
 * loop (engine -> advice -> behaviour -> new logs -> engine) is exercised, not just the
 * engine on a fixed input.
 *
 * The clock is faked (Date only). Timezone must be set by the process (TZ env var) -- Jest
 * gives tests a copy of process.env, so it cannot be switched mid-run.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as db from "../storage/db";
import { scoreLogs, loadHazardDb } from "../engine/scoring";
import { getWellnessScore } from "../engine/wellnessState";
import { getFusionReport } from "../engine/fusion";
import { getAdviceInputs, keepAdvice } from "../engine/adviceState";
import { addPlace, answerCheck, getPlacesOverview, newOccupant, saveOccupant, setPlaceHours } from "../engine/places/state";
import { nextChecks } from "../engine/places/evaluate";
import { checkById } from "../data/placeChecks";
import { runActivity } from "../engine/receipts";
import { getJourney, SCAN_NOTE_PREFIX } from "../engine/journeyState";
import { getLiteracy } from "../engine/literacyState";
import { computeStreak, evaluateAndUnlock, CATALOG } from "../engine/achievements";
import { getStarterJourneyStatus, completeStarterQuest } from "../engine/quests";
import { buildLedger, matchesFor } from "../engine/ingredients/ledger";
import { parseIngredients } from "../engine/ingredients/parse";
import { matchIngredients } from "../engine/ingredients/match";
import { computeEngineHealth } from "../engine/science/engineHealth";
import { loadEvidence, evidenceLearningRef } from "../engine/evidence";
import { curriculumRef } from "../data/curriculum";
import { checksForLesson, type ConceptCheck } from "../data/conceptChecks";
import { answerConceptCheck, getRecallState } from "../engine/learningChecksState";
import { dailyLearning } from "../data/wisdom";
import type { Recommendation } from "../engine/types";
import type { ShelfItem } from "../engine/ingredients/types";
import { daysAgoISO, daysBetweenISO, todayISO } from "../util/dates";
import { Rng, hashString } from "./rng";
import { MEALS, PRODUCTS, nutritionOf, type MealOption, type MealSlot, type ProductSpec } from "./catalog";
import type { Persona } from "./personas";

// ---------- date helpers -------------------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, "0");
/** The simulation's own ground truth for "which calendar day is it for this person" -- deliberately
 *  not the app's helper, so the wrong-day audit is not the code marking its own homework. */
export const localISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** What the screens used to stamp as "today" (the UTC day). Kept only to reproduce the bug: pass it as `stampToday`. */
export const legacyToday = (d: Date = new Date()) => d.toISOString().slice(0, 10);

export interface DayRow {
  day: number;
  localDate: string;
  dow: number;
  engaged: boolean;
  wrote: number;
  wellness: number;
  band: string;
  /** how much of the picture the score could see that day (0-100), and whether that was too little to trust */
  coverage: number;
  provisional: boolean;
  components: Record<string, number>;
  /** how much evidence stood behind each part (0..1) */
  confidence: Record<string, number>;
  awarenessPts: number;
  awarenessBand: string;
  streakEvening: number;
  streakMorning: number | null;
  streakMorningTrue: number | null;
  /** What the Dashboard's two trend pills would say that day. */
  scoreTrend: string;
  practiceTrend: string;
  /** How many things the person has decided to keep (and so are out of Focus / Quick Wins) that day. */
  kept: number;
  /** The recommendations behind Focus that day, with where each comes from ("logs" / "shelf"). */
  focusOrigin: string[];
  engineConfidence: number;
  literacyPct: number;
  tier: number;
  shelfIndex: number;
  shelfItems: number;
  focus: string[];
  quick: string[];
  plant: string;
  plantHealth: string;
  fruits: number;
  achievements: number;
  journeyDone: number;
  entries7: number;
  /** what the Places screen would say that day: answered against a reference, meeting it, worth a look, not yet answered */
  places: { compared: number; meets: number; attention: number; unanswered: number };
  /** the questions on the lessons read: how many exist, how many were answered right at least once, how many are due to come back */
  recall: { available: number; attempted: number; recalled: number; due: number };
}

export interface SimEvent {
  day: number;
  type: string;
  detail: string;
  /** numbers worth checking afterwards (a score part before and after an activity) */
  data?: Record<string, number | string>;
}

export interface SimResult {
  persona: string;
  label: string;
  tz: string;
  opts: SimOptions;
  rows: DayRow[];
  events: SimEvent[];
  audit: {
    writes: Record<string, { n: number; mismatched: number }>;
    metricsOverwrites: number;
    shelf: { key: string; name: string; addedDay: number; removedDay: number | null }[];
  };
  final: {
    wellness: unknown;
    ledger: { index: number; items: number; top: { name: string; servingsPerWeek: number; concern: number }[] };
    achievements: string[];
    literacy: { pct: number; tier: number; done: number; total: number };
    counts: Record<string, number>;
    avoided: string[];
  };
  /** Everything the app would have in local storage at the end (only when `snapshot` is requested). */
  snapshot?: Record<string, string>;
}

export interface SimOptions {
  seed: number;
  days: number;
  endLocalDate: string;
  /** Does the persona act on recommendations? Off isolates logging effects from behaviour change. */
  adopt: boolean;
  thoroughOverride?: number;
  label?: string;
  /** Also return the app's final local-storage contents, so the run can be loaded into a real app to look at. */
  snapshot?: boolean;
  /** Which "today" the simulated screens stamp on entries (default: the app's local-date helper). */
  stampToday?: (d: Date) => string;
  /** Mirror of the date helpers the screens use (only for the replicated Dashboard / Engine Room maths). */
  mirror?: { iso: (d: Date) => string; daysAgo: (n: number, now: Date) => string };
}

const IMPACT_EFFORT_ADOPT: Record<string, number> = { low: 0.55, medium: 0.28, high: 0.12 };
/** Of the advice a person does not act on at their weekly review, the share they answer with "I'm keeping this" (rather than ignoring it). */
const KEEP_GIVEN_NOT_ADOPTED = 0.4;

const MOODS = ["good", "okay", "rough"] as const;

function pDay(p: Persona, day: number, dow: number): number {
  const motivation = p.engage.floor + (1 - p.engage.floor) * Math.exp(-day / p.engage.halfLifeDays);
  const weekend = dow === 0 || dow === 6 ? p.engage.weekendFactor : 1;
  const dis = p.engage.disruptions.find((x) => day >= x.from && day <= x.to)?.factor ?? 1;
  return Math.max(0, Math.min(1, p.engage.base * motivation * weekend * dis));
}

export async function simulate(p: Persona, opt: SimOptions): Promise<SimResult> {
  const stampToday = opt.stampToday ?? ((d: Date) => todayISO(d));
  const mirror = opt.mirror ?? { iso: (d: Date) => todayISO(d), daysAgo: daysAgoISO };

  await AsyncStorage.clear();
  const root = new Rng(opt.seed ^ hashString(p.id));
  const dietR = root.fork("diet");
  const engageR = root.fork("engage");
  const mealLogR = root.fork("meallog");
  const miscR = root.fork("misc");
  const behR = root.fork("behavior");
  const placesR = root.fork("places");
  const recallR = root.fork("recall");

  const [ey, em, ed] = opt.endLocalDate.split("-").map(Number);
  const startDate = new Date(ey, em - 1, ed - (opt.days - 1));
  const at = (day: number, minutes: number) => {
    const m = Math.max(0, Math.min(1439, Math.round(minutes)));
    jest.setSystemTime(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + day, Math.floor(m / 60), m % 60, 0, 0));
  };

  const rows: DayRow[] = [];
  const events: SimEvent[] = [];
  const writes: SimResult["audit"]["writes"] = {};
  let metricsOverwrites = 0;
  const activityLocalDates = new Set<string>();
  const shelfLedger: SimResult["audit"]["shelf"] = [];
  const shelfKeyById = new Map<string, string>();
  const avoid = new Set<string>();
  let avoidUpf = false;
  let curDay = 0;

  const triggerCache = new Map<string, string[]>();
  const triggersFor = (text: string): string[] => {
    const hit = triggerCache.get(text);
    if (hit) return hit;
    const report = scoreLogs({
      food: [{ id: "x", log_date: "2026-01-01", meal: "lunch", food_item: text, processing_level: null, notes: "", created_at: "" }],
      products: [], environment: [], air_quality: [], practices: [],
    });
    const ids = Object.values(report.category_summary).flatMap((c) => c?.substances.map((s) => s.id) ?? []);
    triggerCache.set(text, ids);
    return ids;
  };

  const stamp = (kind: string): string => {
    const now = new Date();
    const s = stampToday(now);
    const w = (writes[kind] ??= { n: 0, mismatched: 0 });
    w.n += 1;
    if (s !== localISO(now)) w.mismatched += 1;
    return s;
  };
  const noteActivity = () => activityLocalDates.add(localISO(new Date()));

  // ---------- what the screens do ----------------------------------------------------------
  const logFood = async (slot: MealSlot, opt2: MealOption, labelled: boolean) => {
    await db.insertFoodLog({ log_date: stamp("food"), meal: slot, food_item: opt2.text, processing_level: labelled ? opt2.nova : null, notes: "" });
    noteActivity();
  };
  const logPractice = async (type: "sleep" | "hydration" | "exercise" | "screen_free", minutes: number | null) => {
    await db.insertPracticeLog({ log_date: stamp("practice"), practice_type: type, duration_minutes: minutes, detail: "", notes: "" });
    noteActivity();
  };
  const saveNumbers = async () => {
    const stampDate = stamp("metrics");
    const existing = (await db.getDailyMetrics(500)).find((m) => m.log_date === stampDate);
    if (existing && localISO(new Date(existing.created_at)) !== localISO(new Date())) metricsOverwrites += 1;
    const r = (lohi: [number, number]) => Math.round(miscR.range(lohi[0], lohi[1]) * 10) / 10;
    await db.upsertDailyMetrics({ log_date: stampDate, calories: Math.round(r(p.numbers.calories)), active_minutes: Math.round(r(p.numbers.active)), screen_hours: r(p.numbers.screen) });
  };
  const checkIn = async () => {
    const mood = MOODS[miscR.pick([0, 0, 0, 1, 1, 2])];
    await db.insertCheckInLog({ log_date: stamp("checkin"), mood, reflection: mood === "rough" ? "long day" : "fine", planForTomorrow: miscR.chance(0.4) ? "cook at home" : "" });
  };
  const scan = async (key: string) => {
    const spec: ProductSpec = PRODUCTS[key];
    const parsed = parseIngredients(spec.ingredients);
    const match = matchIngredients(parsed);
    const contains = match.matches.map((m) => m.name).join(", ");
    const notes = `${SCAN_NOTE_PREFIX}label.${contains ? ` Contains: ${contains}.` : ""}`;
    const item = await db.insertShelfItem({
      name: spec.name, brand: spec.brand, kind: spec.kind, barcode: null, source: "text", ingredientsText: spec.ingredients,
      nova: spec.nova, nutrition: nutritionOf(spec), frequency: spec.frequency, servingsPerUse: spec.servingsPerUse,
    });
    shelfKeyById.set(item.id, key);
    shelfLedger.push({ key, name: spec.name, addedDay: curDay, removedDay: null });
    if (spec.kind === "food") await db.insertFoodLog({ log_date: stamp("scan"), meal: "snack", food_item: spec.name, processing_level: spec.nova, notes });
    else await db.insertProductLog({ log_date: stamp("scan"), product_type: "scanned", product_name: spec.name, ingredients_text: contains, notes });
    noteActivity();
    events.push({ day: curDay, type: "scan", detail: `${spec.name}${contains ? ` -> ${contains}` : " -> nothing flagged"}` });
  };
  // The person's own memory, apart from the app's record of it: how many times each question has been in front of them.
  const looks = new Map<string, number>();
  const tryQuestion = async (check: ConceptCheck, via: "lesson" | "daily" | "review") => {
    const seen = looks.get(check.id) ?? 0;
    const correct = recallR.chance(Math.min(0.97, p.recall.accuracy + p.recall.gain * seen));
    looks.set(check.id, seen + 1);
    const receipt = await answerConceptCheck(check.id, correct, new Date());
    const line = receipt.lines.find((l) => l.key === "learning");
    events.push({
      day: curDay, type: "recall", detail: `${via}: ${check.id} -> ${correct ? "right" : "missed"}`,
      data: { key: line?.key ?? "none", before: line?.before.value ?? 0, after: line?.after.value ?? 0, correct: correct ? 1 : 0, lesson: check.lessonId },
    });
  };
  const dailyRecall = async () => {
    const s = await getRecallState(new Date(), 1);
    if (!s.answeredToday && s.next[0]) await tryQuestion(s.next[0].check, "daily");
  };
  const reviewRecall = async () => {
    for (const n of (await getRecallState(new Date(), 3)).next) await tryQuestion(n.check, "review");
  };
  const readEvidence = new Set<string>();
  const learnOne = async () => {
    const lit = await getLiteracy();
    const r = miscR.next();
    if (r < 0.65 && lit.next) {
      await db.recordLearning(curriculumRef(lit.next.id), stamp("learn"));
      events.push({ day: curDay, type: "lesson", detail: lit.next.id });
      if (recallR.chance(p.recall.inlineProb)) for (const c of checksForLesson(lit.next.id)) await tryQuestion(c, "lesson");
    } else if (r < 0.85) {
      const pool = loadEvidence().filter((e) => !readEvidence.has(e.id));
      const e = pool.length ? (miscR.chance(0.7) ? pool[0] : miscR.pick(pool)) : null;
      if (e) {
        readEvidence.add(e.id);
        await db.recordLearning(evidenceLearningRef(e.id), stamp("learn"));
        events.push({ day: curDay, type: "evidence", detail: e.id });
      }
    } else {
      await db.recordLearning(`daily:${dailyLearning(new Date(), lit.tier).id}`, stamp("learn"));
    }
  };
  const completeQuest = async () => {
    const status = await getStarterJourneyStatus();
    const next = status.quests.find((q) => !q.completed);
    if (next) {
      await completeStarterQuest(next.id);
      events.push({ day: curDay, type: "quest", detail: next.id });
    }
  };

  const retireShelf = async (substanceId: string) => {
    for (const item of await db.getShelfItems(false)) {
      const hits = matchesFor(item).some((m) => m.substanceId === substanceId);
      if (!hits || !behR.chance(0.6)) continue;
      await db.removeShelfItem(item.id);
      const key = shelfKeyById.get(item.id);
      const entry = shelfLedger.find((s) => s.key === key && s.removedDay === null);
      if (entry) entry.removedDay = curDay;
      events.push({ day: curDay, type: "retire", detail: item.name });
      const swap = key ? PRODUCTS[key]?.swapTo : undefined;
      if (swap && behR.chance(0.6)) await scan(swap);
    }
  };
  const adoptRec = async (rec: Recommendation) => {
    await db.markActionCompleted(rec.tip_key, rec.tip, stamp("action"));
    const head = rec.tip_key.split(":")[0];
    events.push({ day: curDay, type: "adopt", detail: rec.tip_key });
    if (rec.origin === "places" || (rec.viaPlaces?.length ?? 0) > 0) await placeFix(head);
    if (head === "processing") avoidUpf = true;
    else if (head !== "produce" && head !== "air_quality" && head !== "starter") {
      avoid.add(head);
      await retireShelf(head);
    }
  };

  const drawMeal = (slot: MealSlot): MealOption => {
    const pool = MEALS[p.id][slot];
    let choice = dietR.pick(pool);
    for (let tries = 0; tries < 3; tries++) {
      const bad = triggersFor(choice.text).some((id) => avoid.has(id)) || (avoidUpf && choice.nova === 4);
      if (!bad || dietR.chance(0.2)) break;
      choice = dietR.pick(pool);
    }
    return choice;
  };

  // ---------- reading the engine like the Dashboard / Engine Room do -----------------------
  const readEngine = async (engaged: boolean, wrote: number, streakMorning: number | null, streakMorningTrue: number | null): Promise<DayRow> => {
    const now = new Date();
    if (engaged) await evaluateAndUnlock();
    const [wellness, fusion, journey, literacy, streak] = await Promise.all([getWellnessScore(), getFusionReport(), getJourney(), getLiteracy(), computeStreak()]);
    const logs7 = await db.getLogsForRange(mirror.daysAgo(6, now), mirror.iso(now));
    const report = scoreLogs(logs7, undefined, await db.getCompletedActionKeys(mirror.daysAgo(13, now)), await getAdviceInputs(now));
    const shelf = await db.getShelfItems(true);
    const ledger = buildLedger(shelf, now);
    const bio = (await db.getBiomarkerLogs(1))[0];
    const learning = new Set(await db.getLearningDates(mirror.daysAgo(6, now)));
    const dates = new Set([...logs7.food, ...logs7.products, ...logs7.environment, ...logs7.air_quality, ...logs7.practices].map((e) => e.log_date));
    const types = [logs7.food, logs7.products, logs7.environment, logs7.air_quality, logs7.practices].filter((a) => a.length > 0).length;
    const evidence = loadEvidence();
    const profile = await db.getUserProfile();
    const health = computeEngineHealth({
      daysLoggedThisWeek: dates.size, inputTypesThisWeek: types,
      daysSinceBiomarker: bio ? Math.max(0, daysBetweenISO(bio.log_date, todayISO(now))) : null,
      learningDaysLast7: learning.size,
      profileFieldsFilled: profile ? [profile.ageYears !== null, profile.sex !== null, profile.weightKg !== null, profile.conditions.length > 0].filter(Boolean).length : 0,
      evidenceItems: evidence.length, evidenceNewestYear: evidence.length ? Math.max(...evidence.map((e) => e.year)) : null,
    }, now);
    const unlocked = await db.getUnlockedAchievementKeys();
    return {
      day: curDay, localDate: localISO(now), dow: now.getDay(), engaged, wrote,
      wellness: wellness.overall, band: wellness.band, coverage: wellness.coverage, provisional: wellness.provisional,
      components: Object.fromEntries(wellness.components.map((c) => [c.key, c.raw])),
      confidence: Object.fromEntries(wellness.components.map((c) => [c.key, c.confidence])),
      awarenessPts: report.overall_score, awarenessBand: report.awareness_band.label,
      streakEvening: streak, streakMorning, streakMorningTrue,
      scoreTrend: fusion.aggregate.scoreTrend, practiceTrend: fusion.aggregate.practiceTrend,
      kept: (await db.getKeptAdvice(todayISO(now))).length,
      focusOrigin: fusion.acute.focusItems.map((f) => f.origin ?? "logs"),
      engineConfidence: health.overall, literacyPct: literacy.pct, tier: literacy.tier,
      shelfIndex: ledger.index, shelfItems: ledger.itemCount,
      focus: fusion.acute.focusItems.map((f) => f.tip_key), quick: fusion.acute.quickWins.map((q) => q.tip_key),
      plant: journey.plant.stageLabel, plantHealth: journey.plant.health, fruits: journey.plant.fruits,
      achievements: unlocked.size, journeyDone: journey.done,
      entries7: Object.values(report.entries_analyzed).reduce((a, b) => a + b, 0),
      places: await getPlacesOverview(now).then((o) => ({ compared: o.summary.compared, meets: o.summary.meets, attention: o.summary.attention, unanswered: o.summary.unanswered })),
      recall: await getRecallState(now, 1).then((s) => ({ available: s.recall.available, attempted: s.recall.attempted, recalled: s.recall.recalled, due: s.recall.due })),
    };
  };

  // ---------- places: what the person tells the app about where they live and work ----------
  const cfg = p.places;
  const placeIds = new Map<number, string>();
  const current = cfg.plans.map((plan) => ({ ...plan.truth }));
  const given = new Set<string>();
  const joined = new Set<string>();
  const skipped = new Set<string>();

  const answerPlace = async (idx: number, checkId: string, value: string, type: "place_answer" | "place_fix") => {
    const placeId = placeIds.get(idx)!;
    const { receipt } = await runActivity("place_check", () => answerCheck(placeId, checkId, value, new Date()));
    const line = receipt.lines[0];
    given.add(`${idx}:${checkId}`);
    events.push({
      day: curDay, type, detail: `${cfg.plans[idx].label}: ${checkId} -> ${value}`,
      data: { key: line.key, before: line.before.value, after: line.after.value, beforeConfidence: line.before.confidence, afterConfidence: line.after.confidence },
    });
  };

  const createPlan = async (idx: number) => {
    const plan = cfg.plans[idx];
    const place = await addPlace(plan.kind, plan.label);
    placeIds.set(idx, place.id);
    if (plan.hours) await setPlaceHours(place.id, plan.hours);
    events.push({ day: curDay, type: "place_setup", detail: plan.label });
  };

  const visitPlaces = async () => {
    if (curDay < cfg.startDay || cfg.plans.length === 0) return;
    // set places up one at a time, as a person would: the next once the current one has been gone through
    if (placeIds.size === 0) await createPlan(0);
    else if (placeIds.size < cfg.plans.length && Object.keys(cfg.plans[placeIds.size - 1].truth).every((k) => given.has(`${placeIds.size - 1}:${k}`))) await createPlan(placeIds.size);

    // people who share a place: present from the start, or arriving later (which changes how findings count)
    for (const [idx, placeId] of placeIds) {
      for (const o of cfg.plans[idx].occupants ?? []) {
        const id = `${idx}:${o.label}`;
        if (joined.has(id) || (o.joinDay ?? 0) > curDay) continue;
        joined.add(id);
        const { joinDay: _ignored, ...person } = o;
        const { receipt } = await runActivity("place_context", () => saveOccupant(placeId, newOccupant(person)));
        const line = receipt.lines[0];
        events.push({ day: curDay, type: "household", detail: `${o.label} shares ${cfg.plans[idx].label}`, data: { key: line.key, before: line.before.value, after: line.after.value, beforeConfidence: line.before.confidence, afterConfidence: line.after.confidence } });
      }
    }

    // then answer the questions the app suggests next, in the order it suggests them
    const overview = await getPlacesOverview(new Date());
    const queue = nextChecks(overview.places, loadHazardDb(), todayISO(new Date()), overview.profile, 40, overview.completedOn).filter((n) => !skipped.has(`${n.place.id}:${n.check.id}`));
    let answered = 0;
    for (const q of queue) {
      if (answered >= cfg.perVisit) break;
      const idx = [...placeIds].find(([, id]) => id === q.place.id)![0];
      const value = current[idx][q.check.id];
      if (value === undefined) {
        skipped.add(`${q.place.id}:${q.check.id}`);
        continue;
      }
      await answerPlace(idx, q.check.id, value, "place_answer");
      answered += 1;
    }
  };

  /** Acting on advice about a substance that stands in a place: change what they can (a workplace is harder to change than a home). */
  const placeFix = async (substanceId: string) => {
    for (const [idx] of placeIds) {
      const plan = cfg.plans[idx];
      for (const [checkId, fixValue] of Object.entries(plan.fix ?? {})) {
        const check = checkById(checkId)!;
        if (check.substanceId !== substanceId && !check.options.some((o) => o.substanceId === substanceId)) continue;
        if (current[idx][checkId] === fixValue) continue;
        if (!placesR.chance(plan.kind === "work" ? 0.35 : 0.85)) continue;
        current[idx][checkId] = fixValue;
        if (given.has(`${idx}:${checkId}`)) await answerPlace(idx, checkId, fixValue, "place_fix");
      }
    }
  };

  const trueStreakThroughYesterday = (day: number): number => {
    let s = 0;
    for (let k = 1; k <= day; k++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + day - k);
      if (activityLocalDates.has(localISO(d))) s += 1;
      else break;
    }
    return s;
  };

  // ---------- onboarding ------------------------------------------------------------------
  at(0, 8 * 60);
  await db.saveUserProfile({ ...p.profile, completedAt: new Date().toISOString() });

  const pendingBiomarkers = [...p.biomarkers];
  const scanQueue = [...p.scanPlan];
  const scanPool = [...p.scanPool];
  let lastExtraScan = 0;

  for (let day = 0; day < opt.days; day++) {
    curDay = day;
    at(day, 0);
    const dow = new Date().getDay();
    const engaged = engageR.chance(pDay(p, day, dow));
    const shifted = p.lateShift ? engageR.chance(p.lateShift.prob) : false;
    const shift = shifted && p.lateShift ? p.lateShift.minutes : 0;
    const t = (base: number, jitter = 20) => base + shift + miscR.int(-jitter, jitter);

    // what they actually eat is decided regardless of whether they log it
    const truth: { slot: MealSlot; option: MealOption }[] = [];
    if (!dietR.chance(p.skipBreakfast)) truth.push({ slot: "breakfast", option: drawMeal("breakfast") });
    truth.push({ slot: "lunch", option: drawMeal("lunch") });
    truth.push({ slot: "dinner", option: drawMeal("dinner") });
    if (dietR.chance(0.6)) truth.push({ slot: "snack", option: drawMeal("snack") });

    const acts: { t: number; run: () => Promise<void> }[] = [];
    const thorough = opt.thoroughOverride ?? p.thorough;
    if (engaged) {
      for (const m of truth) {
        if (mealLogR.chance(thorough)) {
          const labelled = mealLogR.chance(p.novaLabelProb);
          acts.push({ t: t(p.schedule[m.slot]), run: () => logFood(m.slot, m.option, labelled) });
        }
      }
      const pt = t(p.schedule.practice);
      if (miscR.chance(p.habits.sleepLogProb)) acts.push({ t: pt, run: () => logPractice("sleep", Math.max(240, Math.round(miscR.normal(p.habits.sleepMean, p.habits.sleepSd)))) });
      if (miscR.chance(p.habits.hydrationProb)) acts.push({ t: pt + 1, run: () => logPractice("hydration", null) });
      if (miscR.chance(p.habits.exerciseProb)) acts.push({ t: pt + 2, run: () => logPractice("exercise", miscR.int(p.habits.exerciseMinutes[0], p.habits.exerciseMinutes[1])) });
      if (miscR.chance(p.habits.screenFreeProb)) acts.push({ t: pt + 3, run: () => logPractice("screen_free", 60) });
      if (miscR.chance(p.numbers.prob)) acts.push({ t: t(p.schedule.numbers), run: saveNumbers });
      if (p.schedule.checkIn > 0 && miscR.chance(p.checkInProb)) acts.push({ t: t(p.schedule.checkIn), run: checkIn });
      if (miscR.chance(p.learnProb)) acts.push({ t: t(p.schedule.learn), run: learnOne });
      if (recallR.chance(p.recall.dailyProb)) acts.push({ t: t(p.schedule.learn) + 3, run: dailyRecall });
      if (recallR.chance(p.recall.reviewProb)) acts.push({ t: t(p.schedule.learn) + 6, run: reviewRecall });
      if (day >= cfg.startDay && placesR.chance(cfg.visitProb)) acts.push({ t: t(p.schedule.learn) - 15, run: visitPlaces });
      if (miscR.chance(p.questProb)) acts.push({ t: pt + 5, run: completeQuest });
      if (scanQueue.length > 0) {
        const key = scanQueue.shift()!;
        acts.push({ t: t(p.schedule.dinner) + 10, run: () => scan(key) });
      } else if (scanPool.length > 0 && day - lastExtraScan >= p.scanEveryDays) {
        const key = scanPool.splice(miscR.int(0, scanPool.length - 1), 1)[0];
        lastExtraScan = day;
        acts.push({ t: t(p.schedule.dinner) + 10, run: () => scan(key) });
      }
      const dueBio = pendingBiomarkers.filter((b) => b.day <= day);
      for (const b of dueBio) {
        pendingBiomarkers.splice(pendingBiomarkers.indexOf(b), 1);
        acts.push({ t: t(p.schedule.practice) + 8, run: async () => { await db.insertBiomarkerLog({ log_date: stamp("biomarker"), metric: b.metric, value: b.value, unit: b.unit, source: b.source, notes: "" }); events.push({ day, type: "biomarker", detail: `${b.metric} ${b.value}` }); } });
      }
      const inEpisode = p.air.episodes?.find((e) => day >= e.from && day <= e.to);
      if (miscR.chance(inEpisode ? Math.min(1, p.air.logProb * 3) : p.air.logProb)) {
        const value = Math.max(1, Math.round((inEpisode ? miscR.normal(inEpisode.mean, inEpisode.sd) : miscR.normal(p.air.pmMean, p.air.pmSd)) * 10) / 10);
        acts.push({ t: t(p.schedule.lunch) + 5, run: async () => { await db.insertAirQualityLog({ log_date: stamp("air"), location: p.air.place, pollutant: "PM2.5", value, source: "manual", notes: "" }); noteActivity(); } });
      }
      if (dow === p.reviewDow && opt.adopt) {
        acts.push({
          t: t(p.schedule.review),
          run: async () => {
            const fusion = await getFusionReport();
            const motivation = p.engage.floor + (1 - p.engage.floor) * Math.exp(-day / p.engage.halfLifeDays);
            const seen = new Set<string>();
            const focusKeys = fusion.acute.focusItems.map((f) => f.tip_key);
            events.push({ day, type: "review", detail: focusKeys.join(" | ") || "(nothing)" });
            for (const rec of [...fusion.acute.focusItems, ...fusion.acute.quickWins]) {
              if (seen.has(rec.tip_key)) continue;
              seen.add(rec.tip_key);
              if (rec.completed) continue;
              if (behR.chance((IMPACT_EFFORT_ADOPT[rec.action_effort] ?? 0.2) * motivation * p.adoptEagerness)) await adoptRec(rec);
              else if (behR.chance(KEEP_GIVEN_NOT_ADOPTED)) {
                await keepAdvice(rec.tip_key.split(":")[0], rec.source);
                events.push({ day, type: "keep", detail: rec.tip_key });
              }
            }
          },
        });
      }
    }

    acts.sort((a, b) => a.t - b.t);
    if (acts.length === 0) {
      at(day, 21 * 60);
      rows.push(await readEngine(false, 0, null, null));
      continue;
    }

    let morningStreak: number | null = null;
    let morningTrue: number | null = null;
    at(day, Math.max(0, acts[0].t - 2));
    morningStreak = await computeStreak();
    morningTrue = trueStreakThroughYesterday(day);

    const before = Object.values(writes).reduce((n, w) => n + w.n, 0);
    for (const a of acts) {
      at(day, a.t);
      await a.run();
    }
    const wrote = Object.values(writes).reduce((n, w) => n + w.n, 0) - before;
    at(day, acts[acts.length - 1].t + 5);
    rows.push(await readEngine(true, wrote, morningStreak, morningTrue));
  }

  // ---------- final state ---------------------------------------------------------------
  at(opt.days - 1, 23 * 60);
  const wellness = await getWellnessScore();
  const shelf: ShelfItem[] = await db.getShelfItems(true);
  const ledger = buildLedger(shelf, new Date());
  const unlocked = await db.getUnlockedAchievementKeys();
  const literacy = await getLiteracy();
  const all = await db.getRecentLogs(100000);
  const result: SimResult = {
    persona: p.id, label: p.label, tz: p.tz, opts: { ...opt, stampToday: undefined, mirror: undefined, snapshot: undefined }, rows, events,
    audit: { writes, metricsOverwrites, shelf: shelfLedger },
    final: {
      wellness,
      ledger: { index: ledger.index, items: ledger.itemCount, top: ledger.substances.slice(0, 5).map((s) => ({ name: s.name, servingsPerWeek: s.servingsPerWeek, concern: s.concernLevel })) },
      achievements: CATALOG.filter((a) => unlocked.has(a.key)).map((a) => a.name),
      literacy: { pct: literacy.pct, tier: literacy.tier, done: literacy.doneCount, total: literacy.totalCount },
      counts: { food: all.food.length, products: all.products.length, environment: all.environment.length, air_quality: all.air_quality.length, practices: all.practices.length, biomarkers: all.biomarkers.length },
      avoided: [...avoid, ...(avoidUpf ? ["ultra-processed"] : [])],
    },
  };
  if (opt.snapshot) {
    const keys = [...(await AsyncStorage.getAllKeys())];
    result.snapshot = Object.fromEntries((await AsyncStorage.multiGet(keys)).filter(([, v]) => v !== null) as [string, string][]);
  }
  return result;
}
