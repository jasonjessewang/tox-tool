/**
 * Local, on-device storage -- mirrors tox-exposure-tool/db.py's table shapes, backed by
 * AsyncStorage (one JSON array per "table") instead of SQLite for this first verified
 * slice. Local-only, no account, no network required to use the app -- matches the
 * no-login-by-default decision. A production build with heavier query needs would swap
 * this module for expo-sqlite behind the same function signatures.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ShelfItem } from "../engine/ingredients/types";
import type { Place } from "../engine/places/types";
import type { WeightKey } from "../engine/wellnessScore";
import type {
  FoodLog,
  ProductLog,
  EnvironmentLog,
  AirQualityLog,
  PracticeLog,
  BiomarkerLog,
  CheckInLog,
  DailyMetricLog,
  LogStore,
  UserProfile,
} from "../engine/types";

/**
 * Every AsyncStorage key the app owns. Exported so the score's activity registry can require that each
 * one is classified (see engine/signals/registry.ts): a new key cannot be added without saying how
 * what is stored in it factors into the picture, or why it does not.
 */
export const KEYS = {
  food: "exposure:food_logs",
  products: "exposure:product_logs",
  environment: "exposure:environment_logs",
  air_quality: "exposure:air_quality_logs",
  practices: "exposure:practice_logs",
  biomarkers: "exposure:biomarker_logs",
  checkins: "exposure:checkin_logs",
  metrics: "exposure:daily_metrics",
  learning: "exposure:learning_events",
  shelf: "exposure:shelf_items",
  score_weights: "exposure:score_weights",
  completed_actions: "exposure:completed_actions",
  kept_advice: "exposure:kept_advice",
  places: "exposure:places",
  achievements: "exposure:achievements",
  profile: "exposure:user_profile",
} as const;

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Every write below is a read-modify-write cycle on one shared AsyncStorage key
 * (read the array, mutate in memory, write it back). Two overlapping calls against the
 * same key -- e.g. a double-tapped "Save", or a log insert racing a background sync --
 * would otherwise both read the same starting array and the second write to finish
 * would silently clobber the first. This serializes writes per key (reads stay
 * unlocked, since they don't need to queue behind each other) so that race is closed
 * without changing any function's external behavior in the common, non-overlapping case.
 */
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prior = locks.get(key) ?? Promise.resolve();
  const run = prior.then(fn, fn);
  locks.set(key, run.then(
    () => undefined,
    () => undefined
  ));
  return run;
}

async function readArray<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    // Corrupted value (e.g. an interrupted write during an app kill) -- degrade to
    // empty rather than throwing and bricking whatever screen reads this key.
    console.warn(`[storage] corrupted JSON at key "${key}", treating as empty`);
    return [];
  }
}

async function writeArray<T>(key: string, arr: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(arr));
}

async function append<T extends { id: string; created_at: string }>(
  key: string,
  entry: Omit<T, "id" | "created_at">
): Promise<T> {
  return withLock(key, async () => {
    const arr = await readArray<T>(key);
    const full = { ...entry, id: newId(), created_at: new Date().toISOString() } as T;
    arr.unshift(full);
    await writeArray(key, arr);
    return full;
  });
}

export async function insertFoodLog(entry: Omit<FoodLog, "id" | "created_at">) {
  return append<FoodLog>(KEYS.food, entry);
}
export async function insertProductLog(entry: Omit<ProductLog, "id" | "created_at">) {
  return append<ProductLog>(KEYS.products, entry);
}
export async function insertEnvironmentLog(entry: Omit<EnvironmentLog, "id" | "created_at">) {
  return append<EnvironmentLog>(KEYS.environment, entry);
}
export async function insertAirQualityLog(entry: Omit<AirQualityLog, "id" | "created_at">) {
  return append<AirQualityLog>(KEYS.air_quality, entry);
}
export async function insertPracticeLog(entry: Omit<PracticeLog, "id" | "created_at">) {
  return append<PracticeLog>(KEYS.practices, entry);
}
export async function insertBiomarkerLog(entry: Omit<BiomarkerLog, "id" | "created_at">) {
  return append<BiomarkerLog>(KEYS.biomarkers, entry);
}
export async function getBiomarkerLogs(limit = 20): Promise<BiomarkerLog[]> {
  const arr = await readArray<BiomarkerLog>(KEYS.biomarkers);
  return arr.slice(0, limit);
}
export async function insertCheckInLog(entry: Omit<CheckInLog, "id" | "created_at">) {
  return append<CheckInLog>(KEYS.checkins, entry);
}
export async function upsertDailyMetrics(entry: Omit<DailyMetricLog, "id" | "created_at">) {
  return withLock(KEYS.metrics, async () => {
    const arr = await readArray<DailyMetricLog>(KEYS.metrics);
    const kept = arr.filter((e) => e.log_date !== entry.log_date);
    const full = { ...entry, id: newId(), created_at: new Date().toISOString() } as DailyMetricLog;
    kept.unshift(full);
    await writeArray(KEYS.metrics, kept);
    return full;
  });
}
export async function getDailyMetrics(limit = 60): Promise<DailyMetricLog[]> {
  const arr = await readArray<DailyMetricLog>(KEYS.metrics);
  return arr.slice(0, limit);
}
export async function insertShelfItem(entry: Omit<ShelfItem, "id" | "addedAt" | "removedAt">): Promise<ShelfItem> {
  return withLock(KEYS.shelf, async () => {
    const arr = await readArray<ShelfItem>(KEYS.shelf);
    const item: ShelfItem = { ...entry, id: newId(), addedAt: new Date().toISOString(), removedAt: null };
    arr.unshift(item);
    await writeArray(KEYS.shelf, arr);
    return item;
  });
}
export async function getShelfItems(includeRemoved = false): Promise<ShelfItem[]> {
  const arr = await readArray<ShelfItem>(KEYS.shelf);
  return includeRemoved ? arr : arr.filter((i) => i.removedAt === null);
}
export async function updateShelfItem(id: string, patch: Partial<Pick<ShelfItem, "frequency" | "servingsPerUse" | "name">>): Promise<void> {
  await withLock(KEYS.shelf, async () => {
    const arr = await readArray<ShelfItem>(KEYS.shelf);
    await writeArray(KEYS.shelf, arr.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  });
}
/** Soft delete: the item stops counting from now on, but past weeks of the ledger stay reconstructable. */
export async function removeShelfItem(id: string): Promise<void> {
  await withLock(KEYS.shelf, async () => {
    const arr = await readArray<ShelfItem>(KEYS.shelf);
    await writeArray(KEYS.shelf, arr.map((i) => (i.id === id ? { ...i, removedAt: new Date().toISOString() } : i)));
  });
}

export async function getScoreWeights(): Promise<Record<WeightKey, number> | null> {
  const raw = await AsyncStorage.getItem(KEYS.score_weights);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<WeightKey, number>;
  } catch {
    return null;
  }
}
export async function saveScoreWeights(weights: Record<WeightKey, number>): Promise<void> {
  await withLock(KEYS.score_weights, () => AsyncStorage.setItem(KEYS.score_weights, JSON.stringify(weights)));
}

/**
 * What a learning event is worth keeping, by kind. Lessons, papers and tools that have been read are progress: they are never dropped.
 * The rest is a rolling record -- daily reads and recall answers -- and only the recent part of it is kept. (The list used to be cut at
 * the newest 500 events of any kind, which would have quietly un-completed the first lessons of anyone who kept using the app for a year.)
 */
const KEEP_FOREVER = ["curriculum:", "evidence:", "tool:"];
const DAILY_KEPT = 300;
const CHECK_ATTEMPTS_KEPT_PER_QUESTION = 12;
const OTHER_KEPT = 200;

export function trimLearningEvents<T extends { ref: string }>(newestFirst: T[]): T[] {
  const perQuestion = new Map<string, number>();
  let daily = 0;
  let other = 0;
  return newestFirst.filter((e) => {
    if (KEEP_FOREVER.some((p) => e.ref.startsWith(p))) return true;
    if (e.ref.startsWith("daily:")) return daily++ < DAILY_KEPT;
    const check = e.ref.match(/^check:(.+):[01]$/);
    if (check) {
      const n = perQuestion.get(check[1]) ?? 0;
      perQuestion.set(check[1], n + 1);
      return n < CHECK_ATTEMPTS_KEPT_PER_QUESTION;
    }
    return other++ < OTHER_KEPT;
  });
}

export async function recordLearning(ref: string, date: string): Promise<void> {
  await withLock(KEYS.learning, async () => {
    const arr = await readArray<{ ref: string; date: string }>(KEYS.learning);
    if (arr.some((e) => e.ref === ref && e.date === date)) return;
    arr.unshift({ ref, date });
    await writeArray(KEYS.learning, trimLearningEvents(arr));
  });
}
/** Every recorded learning event (newest first): which lesson, topic or paper, and on what day. */
export async function getLearningEvents(): Promise<{ ref: string; date: string }[]> {
  return readArray<{ ref: string; date: string }>(KEYS.learning);
}
export async function getLearningRefs(prefix: string): Promise<string[]> {
  const arr = await readArray<{ ref: string; date: string }>(KEYS.learning);
  return [...new Set(arr.filter((e) => e.ref.startsWith(prefix)).map((e) => e.ref))];
}
export async function getLearningDates(sinceDate: string): Promise<string[]> {
  const arr = await readArray<{ ref: string; date: string }>(KEYS.learning);
  return arr.filter((e) => e.date >= sinceDate).map((e) => e.date);
}
export async function getCheckInLogs(limit = 30): Promise<CheckInLog[]> {
  const arr = await readArray<CheckInLog>(KEYS.checkins);
  return arr.slice(0, limit);
}

/** Removes an entry and hands it back, so the screen can offer to put it back. */
export async function deleteLog<T extends { id: string }>(category: keyof typeof KEYS, id: string): Promise<T | null> {
  const key = KEYS[category];
  return withLock(key, async () => {
    const arr = await readArray<T>(key);
    const removed = arr.find((e) => e.id === id) ?? null;
    if (removed) {
      await writeArray(
        key,
        arr.filter((e) => e.id !== id)
      );
    }
    return removed;
  });
}

/**
 * Puts a removed entry back. Entries are kept newest first, so it goes back by when it was created -- to the place it came from --
 * and putting back something that is already there does nothing.
 */
export async function restoreLog(category: keyof typeof KEYS, entry: { id: string; created_at?: string }): Promise<void> {
  const key = KEYS[category];
  await withLock(key, async () => {
    const arr = await readArray<{ id: string; created_at?: string }>(key);
    if (arr.some((e) => e.id === entry.id)) return;
    const at = arr.findIndex((e) => (e.created_at ?? "") < (entry.created_at ?? ""));
    arr.splice(at === -1 ? arr.length : at, 0, entry);
    await writeArray(key, arr);
  });
}

function inRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

export async function getLogsForRange(start: string, end: string): Promise<LogStore> {
  const [food, products, environment, air_quality, practices] = await Promise.all([
    readArray<FoodLog>(KEYS.food),
    readArray<ProductLog>(KEYS.products),
    readArray<EnvironmentLog>(KEYS.environment),
    readArray<AirQualityLog>(KEYS.air_quality),
    readArray<PracticeLog>(KEYS.practices),
  ]);
  return {
    food: food.filter((e) => inRange(e.log_date, start, end)),
    products: products.filter((e) => inRange(e.log_date, start, end)),
    environment: environment.filter((e) => inRange(e.log_date, start, end)),
    air_quality: air_quality.filter((e) => inRange(e.log_date, start, end)),
    practices: practices.filter((e) => inRange(e.log_date, start, end)),
  };
}

export async function getRecentLogs(limit = 15): Promise<LogStore & { biomarkers: BiomarkerLog[] }> {
  const [food, products, environment, air_quality, practices, biomarkers] = await Promise.all([
    readArray<FoodLog>(KEYS.food),
    readArray<ProductLog>(KEYS.products),
    readArray<EnvironmentLog>(KEYS.environment),
    readArray<AirQualityLog>(KEYS.air_quality),
    readArray<PracticeLog>(KEYS.practices),
    readArray<BiomarkerLog>(KEYS.biomarkers),
  ]);
  const cap = <T,>(arr: T[]) => arr.slice(0, limit);
  return {
    food: cap(food),
    products: cap(products),
    environment: cap(environment),
    air_quality: cap(air_quality),
    practices: cap(practices),
    biomarkers: cap(biomarkers),
  };
}

export async function getDistinctLogDates(days = 60): Promise<string[]> {
  const [food, products, environment, air_quality, practices] = await Promise.all([
    readArray<FoodLog>(KEYS.food),
    readArray<ProductLog>(KEYS.products),
    readArray<EnvironmentLog>(KEYS.environment),
    readArray<AirQualityLog>(KEYS.air_quality),
    readArray<PracticeLog>(KEYS.practices),
  ]);
  const dates = new Set<string>();
  for (const arr of [food, products, environment, air_quality, practices]) {
    for (const e of arr) dates.add((e as { log_date: string }).log_date);
  }
  return Array.from(dates).sort().reverse().slice(0, days);
}

export async function markActionCompleted(tipKey: string, tipText: string, completedDate: string) {
  await withLock(KEYS.completed_actions, async () => {
    const arr = await readArray<{ tip_key: string; tip_text: string; completed_date: string }>(
      KEYS.completed_actions
    );
    arr.unshift({ tip_key: tipKey, tip_text: tipText, completed_date: completedDate });
    await writeArray(KEYS.completed_actions, arr);
  });
}

export async function getCompletedActionKeys(sinceDate?: string): Promise<Set<string>> {
  const arr = await readArray<{ tip_key: string; completed_date: string }>(KEYS.completed_actions);
  const filtered = sinceDate ? arr.filter((e) => e.completed_date >= sinceDate) : arr;
  return new Set(filtered.map((e) => e.tip_key));
}

export async function getCompletedActions(sinceDate: string): Promise<{ tip_key: string; tip_text: string; completed_date: string }[]> {
  const arr = await readArray<{ tip_key: string; tip_text: string; completed_date: string }>(KEYS.completed_actions);
  return arr.filter((e) => e.completed_date >= sinceDate);
}

// --- Kept advice: "I looked at this and I'm leaving it as it is" ---
// Deliberately not in completed_actions: keeping something is a decision, not an action taken, so it
// must not count toward "actions completed" badges or quick-win quests.

export interface KeptAdvice {
  /** The part of a tip_key before the first colon: the substance (or "processing" / "produce" / "air_quality"). */
  source_key: string;
  /** Human-readable name of what was kept, so the list still reads if the database changes. */
  label: string;
  decided_date: string;
  /** Last day (inclusive) the advice stays out of Focus and Quick Wins. */
  until: string;
}

export async function keepAdvice(entry: KeptAdvice) {
  await withLock(KEYS.kept_advice, async () => {
    const arr = await readArray<KeptAdvice>(KEYS.kept_advice);
    await writeArray(KEYS.kept_advice, [entry, ...arr.filter((k) => k.source_key !== entry.source_key)]);
  });
}

export async function unkeepAdvice(sourceKey: string) {
  await withLock(KEYS.kept_advice, async () => {
    const arr = await readArray<KeptAdvice>(KEYS.kept_advice);
    await writeArray(KEYS.kept_advice, arr.filter((k) => k.source_key !== sourceKey));
  });
}

/** Decisions still in force on `today` (day keys compare as strings). */
export async function getKeptAdvice(today: string): Promise<KeptAdvice[]> {
  return (await readArray<KeptAdvice>(KEYS.kept_advice)).filter((k) => k.until >= today);
}

// --- Places: the spaces a person spends their days in, with dated answers to each checklist question ---

export async function getPlaces(): Promise<Place[]> {
  return readArray<Place>(KEYS.places);
}

/** Inserts or replaces a place, matched by id. */
export async function savePlace(place: Place): Promise<void> {
  await withLock(KEYS.places, async () => {
    const arr = await readArray<Place>(KEYS.places);
    const exists = arr.some((p) => p.id === place.id);
    await writeArray(KEYS.places, exists ? arr.map((p) => (p.id === place.id ? place : p)) : [...arr, place]);
  });
}

/**
 * Read-modify-write on one place under the storage lock, so two quick answers can never clobber each other. `change` gets
 * the current place (or null the first time) and returns the new one.
 */
export async function updatePlace(id: string, change: (current: Place | null) => Place): Promise<Place> {
  return withLock(KEYS.places, async () => {
    const arr = await readArray<Place>(KEYS.places);
    const current = arr.find((p) => p.id === id) ?? null;
    const next = change(current);
    await writeArray(KEYS.places, current ? arr.map((p) => (p.id === id ? next : p)) : [...arr, next]);
    return next;
  });
}

export async function deletePlace(id: string): Promise<void> {
  await withLock(KEYS.places, async () => {
    const arr = await readArray<Place>(KEYS.places);
    await writeArray(KEYS.places, arr.filter((p) => p.id !== id));
  });
}

export async function getUnlockedAchievementKeys(): Promise<Set<string>> {
  const arr = await readArray<string>(KEYS.achievements);
  return new Set(arr);
}

export async function unlockAchievement(key: string): Promise<boolean> {
  return withLock(KEYS.achievements, async () => {
    const arr = await readArray<string>(KEYS.achievements);
    if (arr.includes(key)) return false;
    arr.push(key);
    await writeArray(KEYS.achievements, arr);
    return true;
  });
}

// --- User profile (health intake) ---

export async function getUserProfile(): Promise<UserProfile | null> {
  const raw = await AsyncStorage.getItem(KEYS.profile);
  if (!raw) return null;
  try {
    // Profiles saved before location/check-in settings existed lack those fields.
    return { locationEnabled: false, checkInTime: "off", ...(JSON.parse(raw) as Partial<UserProfile>) } as UserProfile;
  } catch {
    // A corrupted profile blob must not crash boot -- null routes back to onboarding,
    // same as a first-ever launch, rather than throwing out of App.tsx's startup effect.
    console.warn("[storage] corrupted user profile, treating as not onboarded");
    return null;
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await withLock(KEYS.profile, () => AsyncStorage.setItem(KEYS.profile, JSON.stringify(profile)));
}

// --- Location-based alert de-duplication: prevents re-firing the same daily AQI or NWS
// alert notification every time the Digest screen loads within the same day/alert. ---

const ALERT_STATE_KEY = "exposure:location_alert_state";

interface LocationAlertState {
  lastAqiNotifyDate: string | null;
  notifiedWeatherAlertIds: string[];
}

async function readAlertState(): Promise<LocationAlertState> {
  const raw = await AsyncStorage.getItem(ALERT_STATE_KEY);
  if (!raw) return { lastAqiNotifyDate: null, notifiedWeatherAlertIds: [] };
  try {
    return JSON.parse(raw) as LocationAlertState;
  } catch {
    return { lastAqiNotifyDate: null, notifiedWeatherAlertIds: [] };
  }
}

export async function shouldNotifyAqiToday(todayDate: string): Promise<boolean> {
  const state = await readAlertState();
  return state.lastAqiNotifyDate !== todayDate;
}

export async function markAqiNotified(todayDate: string): Promise<void> {
  await withLock(ALERT_STATE_KEY, async () => {
    const state = await readAlertState();
    state.lastAqiNotifyDate = todayDate;
    await AsyncStorage.setItem(ALERT_STATE_KEY, JSON.stringify(state));
  });
}

export async function getUnnotifiedAlertIds(ids: string[]): Promise<string[]> {
  const state = await readAlertState();
  const seen = new Set(state.notifiedWeatherAlertIds);
  return ids.filter((id) => !seen.has(id));
}

export async function markAlertsNotified(ids: string[]): Promise<void> {
  await withLock(ALERT_STATE_KEY, async () => {
    const state = await readAlertState();
    const merged = new Set([...state.notifiedWeatherAlertIds, ...ids]);
    state.notifiedWeatherAlertIds = Array.from(merged).slice(-100);
    await AsyncStorage.setItem(ALERT_STATE_KEY, JSON.stringify(state));
  });
}

/** Dev/demo helper: wipes the person's own data (not caches and settings). See clearEverything for the person-facing "delete". */
export async function clearAll() {
  await Promise.all(Object.values(KEYS).map((k) => AsyncStorage.removeItem(k)));
}

/**
 * Keys that hold no one's activity: caches, connection settings, alert bookkeeping. Registered, with the reason each is not scored,
 * in engine/signals/registry.ts (SERVICE_STORAGE) -- a test keeps the two lists the same.
 */
export const SERVICE_KEYS = ["exposure:location_alert_state", "exposure:literature_cache", "exposure:last_coords", "exposure:backend_config"] as const;

export interface DataExport {
  app: "Exposure Awareness";
  format: 1;
  exportedAt: string;
  note: string;
  /** everything the person has entered, by table (food_logs, shelf_items, places, ...) */
  data: Record<string, unknown>;
}

/**
 * A copy of everything the person has entered, as plain JSON they can keep. Nothing that is a secret or a cache goes in it: no
 * connection settings, no API keys, no last-known location.
 */
export async function exportAllData(now: Date = new Date()): Promise<DataExport> {
  const entries = await AsyncStorage.multiGet(Object.values(KEYS));
  const data: Record<string, unknown> = {};
  for (const [key, raw] of entries) {
    if (raw === null) continue;
    let value: unknown = raw;
    try {
      value = JSON.parse(raw);
    } catch {
      // stored as plain text: keep it as it is
    }
    data[key.replace(/^exposure:/, "")] = value;
  }
  return {
    app: "Exposure Awareness",
    format: 1,
    exportedAt: now.toISOString(),
    note: "Everything here was stored only on your device. Dates are your local calendar days.",
    data,
  };
}

/** Removes everything: the person's data, and also the location cache, connection settings, API key and scheduled-alert bookkeeping. */
export async function clearEverything() {
  await AsyncStorage.multiRemove([...Object.values(KEYS), ...SERVICE_KEYS]);
}
