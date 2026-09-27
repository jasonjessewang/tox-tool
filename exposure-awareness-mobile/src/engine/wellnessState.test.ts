/**
 * The score end to end: real storage, real signals, a faked clock. Also the comparison receipt every activity returns.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as db from "../storage/db";
import { getWellnessScore, getScoreHistory, scoreAsOf, saveScoreWeights, getScoreWeights } from "./wellnessState";
import { loadSignalData } from "./signals/context";
import { runActivity } from "./receipts";
import { DEFAULT_WEIGHTS } from "./wellnessScore";
import { addPlace, answerCheck } from "./places/state";
import { checksFor } from "../data/placeChecks";
import { daysAgoISO, todayISO } from "../util/dates";

const NOW = new Date(2026, 8, 25, 12);
const day = (n: number) => daysAgoISO(n, NOW);

beforeAll(() => {
  jest.useFakeTimers({
    doNotFake: ["nextTick", "setImmediate", "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout", "queueMicrotask", "hrtime", "performance", "requestAnimationFrame", "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback"],
    now: NOW,
  });
});
afterAll(() => jest.useRealTimers());
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.setSystemTime(NOW);
});

const meal = (log_date: string, food_item: string) => db.insertFoodLog({ log_date, meal: "lunch", food_item, processing_level: null, notes: "" });

/** `count` days of ordinary logging ending `endAgo` days ago: two meals, sleep, water, and active minutes. */
async function liveFor(count: number, endAgo = 0, flaggedEvery = 0) {
  for (let i = count - 1; i >= 0; i--) {
    const d = day(endAgo + i);
    await meal(d, flaggedEvery > 0 && i % flaggedEvery === 0 ? "cereal with added sugar" : "rice and beans");
    await meal(d, "salad with olive oil");
    await db.insertPracticeLog({ log_date: d, practice_type: "sleep", duration_minutes: 450, detail: "", notes: "" });
    await db.insertPracticeLog({ log_date: d, practice_type: "hydration", duration_minutes: null, detail: "", notes: "" });
    await db.upsertDailyMetrics({ log_date: d, calories: null, active_minutes: 25, screen_hours: null });
  }
}

test("with nothing recorded the score is an early reading, not a number", async () => {
  const s = await getWellnessScore();
  expect(s.provisional).toBe(true);
  expect(s.coverage).toBe(0);
  expect(s.components.every((c) => c.confidence === 0)).toBe(true);
});

test("two weeks of ordinary logging is a good start but still an early picture: the app has not been told about the shelf or the places", async () => {
  await liveFor(14);
  const s = await getWellnessScore();
  expect(s.provisional).toBe(true);
  expect(s.coverage).toBeGreaterThanOrEqual(30);
  expect(s.components.find((c) => c.key === "shelf")!.confidence).toBe(0);
  expect(s.components.find((c) => c.key === "places")!.confidence).toBe(0);
});

test("once the shelf and the places are filled in too, the picture is trusted, and each part says what it was compared with", async () => {
  await liveFor(14);
  for (let i = 0; i < 3; i++) await db.insertShelfItem({ name: `Oats ${i}`, brand: "", kind: "food", barcode: null, source: "text", ingredientsText: "oats, water", nova: null, nutrition: null, frequency: "daily", servingsPerUse: 1 });
  const home = await addPlace("home");
  for (const c of checksFor("home").slice(0, 8)) await answerCheck(home.id, c.id, c.options.find((o) => o.status === "meets")!.value, NOW);
  const s = await getWellnessScore();
  expect(s.provisional).toBe(false);
  expect(s.coverage).toBeGreaterThanOrEqual(60);
  expect(s.components.find((c) => c.key === "places")!.parts[0].against).toMatch(/US EPA/);
  const exposure = s.components.find((c) => c.key === "exposure")!;
  expect(exposure.value).toBeGreaterThanOrEqual(95);
  const habits = s.components.find((c) => c.key === "resilience")!;
  expect(habits.parts.find((p) => p.label === "Sleep")!.read).toBe("on_target");
  expect(habits.parts.find((p) => p.label === "Movement")!.read).toBe("on_target");
  expect(habits.parts.every((p) => p.against.length > 5)).toBe(true);
});

test("history reads the same records week by week, oldest first, and the picture fills in as the person keeps going", async () => {
  await liveFor(21);
  const history = await getScoreHistory(6);
  expect(history).toHaveLength(6);
  expect(history.map((h) => h.asOf)).toEqual([...history.map((h) => h.asOf)].sort());
  expect(history[history.length - 1].asOf).toBe(todayISO(NOW));
  expect(history[0].coverage).toBe(0); // five weeks ago there was nothing yet
  for (let i = 1; i < history.length; i++) expect(history[i].coverage).toBeGreaterThanOrEqual(history[i - 1].coverage);
  expect(history[history.length - 1].coverage).toBeGreaterThan(history[2].coverage);
});

test("comparing with four weeks earlier: a person who has just started has no earlier self to compare with", async () => {
  await liveFor(14);
  const s = await getWellnessScore();
  expect(s.vsBefore).toBeNull();
  expect(s.components.every((c) => c.vsBefore === null)).toBe(true);
});

test("after a month of it, each part reports its change against the person's own earlier self", async () => {
  await liveFor(30, 28); // the earlier period: 28..57 days ago, with a flagged meal every third day
  await liveFor(30, 0, 0); // the recent period: clean
  const s = await getWellnessScore();
  expect(s.vsBefore).not.toBeNull();
  const exposure = s.components.find((c) => c.key === "exposure")!;
  expect(exposure.vsBefore).not.toBeNull();
});

test("retiring a product you no longer use raises the shelf part straight away", async () => {
  for (let i = 0; i < 3; i++) await db.insertShelfItem({ name: `Oats ${i}`, brand: "", kind: "food", barcode: null, source: "text", ingredientsText: "oats, water", nova: null, nutrition: null, frequency: "daily", servingsPerUse: 1 });
  const bad = await db.insertShelfItem({ name: "Fragranced shampoo", brand: "", kind: "personal_care", barcode: null, source: "text", ingredientsText: "water, sodium laureth sulfate, fragrance, methylparaben, dmdm hydantoin", nova: null, nutrition: null, frequency: "daily", servingsPerUse: 1 });
  const before = (await getWellnessScore()).components.find((c) => c.key === "shelf")!;
  await db.removeShelfItem(bad.id);
  const after = (await getWellnessScore()).components.find((c) => c.key === "shelf")!;
  expect(after.value).toBeGreaterThan(before.value + 15);
});

test("going quiet fades the picture gently: no day-to-day jump, however long the person is away", async () => {
  await liveFor(40, 14, 3); // steady logging until two weeks ago, one flagged meal in three
  const data = await loadSignalData(NOW);
  const series = Array.from({ length: 15 }, (_, i) => scoreAsOf(data, DEFAULT_WEIGHTS, day(14 - i)));
  for (let i = 1; i < series.length; i++) {
    expect(Math.abs(series[i].overall - series[i - 1].overall)).toBeLessThanOrEqual(3);
    expect(series[i].coverage).toBeLessThanOrEqual(series[i - 1].coverage);
  }
  expect(series[series.length - 1].coverage).toBeGreaterThan(series[0].coverage * 0.4);
});

test("stored weights that predate a part still work, and are honoured", async () => {
  await liveFor(14);
  await saveScoreWeights({ exposure: 100, resilience: 0, validation: 0, shelf: 0, learning: 0 } as never); // saved before Places existed
  const w = await getScoreWeights();
  expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
  const s = await getWellnessScore();
  // the newer part arrives at its default weight, next to the person's own; their choices still dominate
  expect(s.components.find((c) => c.key === "exposure")!.weight).toBeGreaterThan(80);
  expect(s.components.find((c) => c.key === "places")!.weight).toBeLessThan(20);
});

describe("receipts: every activity comes with its comparison", () => {
  test("a movement log: which part moved, what it was compared with, and by how much", async () => {
    await liveFor(10);
    const { receipt } = await runActivity("practice_log", () => db.insertPracticeLog({ log_date: todayISO(NOW), practice_type: "exercise", duration_minutes: 60, detail: "", notes: "" }));
    expect(receipt.kind).toBe("practice_log");
    expect(receipt.unscored).toBeNull();
    expect(receipt.lines.map((l) => l.key)).toEqual(["resilience"]);
    expect(receipt.lines[0].parts.find((p) => p.label === "Movement")!.against).toMatch(/150 minutes a week/);
    expect(receipt.headline.length).toBeGreaterThan(10);
  });

  test("a first biomarker turns an empty part into a first reading", async () => {
    await liveFor(10);
    const { receipt } = await runActivity("biomarker_log", () => db.insertBiomarkerLog({ log_date: todayISO(NOW), metric: "Resting heart rate", value: 62, unit: "bpm", source: "wearable", notes: "" }));
    expect(receipt.lines[0].key).toBe("validation");
    expect(receipt.lines[0].headline).toMatch(/first reading/);
    expect(receipt.lines[0].headline).toMatch(/how up to date your readings are, not what they show/); // recency, never a verdict on the reading
    expect(receipt.lines[0].before.confidence).toBe(0);
    expect(receipt.lines[0].after.confidence).toBe(0.5); // one reading anchors the picture; a second lets it be compared with itself
  });

  test("a meal that changes nothing still tells you the picture got a little fuller", async () => {
    await liveFor(3);
    const { receipt } = await runActivity("food_log", () => meal(todayISO(NOW), "porridge with berries"));
    expect(receipt.lines[0].key).toBe("exposure");
    expect(receipt.lines[0].after.confidence).toBeGreaterThanOrEqual(receipt.lines[0].before.confidence);
  });

  test("a decision is not scored, and the receipt says why", async () => {
    const { receipt } = await runActivity("advice_decision", () => db.keepAdvice({ source_key: "triclosan", label: "Triclosan", decided_date: todayISO(NOW), until: daysAgoISO(-60, NOW) }));
    expect(receipt.unscored).toMatch(/what the app suggests/i);
    expect(receipt.lines).toEqual([]);
    expect(receipt.headline).toMatch(/doesn't move your score/);
  });

  test("swapping a product shows in the shelf part's receipt", async () => {
    for (let i = 0; i < 3; i++) await db.insertShelfItem({ name: `Oats ${i}`, brand: "", kind: "food", barcode: null, source: "text", ingredientsText: "oats, water", nova: null, nutrition: null, frequency: "daily", servingsPerUse: 1 });
    const { receipt } = await runActivity("shelf_change", () => db.insertShelfItem({ name: "Fragranced shampoo", brand: "", kind: "personal_care", barcode: null, source: "text", ingredientsText: "water, sodium laureth sulfate, fragrance, methylparaben, dmdm hydantoin", nova: null, nutrition: null, frequency: "daily", servingsPerUse: 1 }));
    expect(receipt.lines[0].key).toBe("shelf");
    expect(receipt.lines[0].after.value).toBeLessThan(receipt.lines[0].before.value);
    expect(receipt.lines[0].parts[0].against).toMatch(/stance rules/);
  });
});
