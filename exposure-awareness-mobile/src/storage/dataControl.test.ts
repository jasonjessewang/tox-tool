/**
 * The person's own data is theirs to take and to remove: a complete export, no secrets in it, and a delete that leaves nothing behind.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as db from "./db";
import { SERVICE_STORAGE } from "../engine/signals/registry";
import { addPlace, answerCheck } from "../engine/places/state";

const NOW = new Date(2026, 8, 26, 12);

beforeEach(async () => {
  await AsyncStorage.clear();
});

async function fill() {
  await db.saveUserProfile({ ageYears: 34, sex: "unspecified", weightKg: 70, heightCm: 170, pregnant: false, breastfeeding: false, conditions: [], contentComplexity: "balanced", completedAt: NOW.toISOString(), locationEnabled: true, checkInTime: "off" });
  await db.insertFoodLog({ log_date: "2026-09-26", meal: "lunch", food_item: "rice", processing_level: null, notes: "" });
  await db.insertBiomarkerLog({ log_date: "2026-09-26", metric: "Resting heart rate", value: 62, unit: "bpm", source: "", notes: "" });
  const home = await addPlace("home");
  await answerCheck(home.id, "home_gas", "electric", NOW);
  await AsyncStorage.setItem("exposure:backend_config", JSON.stringify({ baseUrl: "http://192.168.1.10:4000", apiKey: "eak_secret" }));
  await AsyncStorage.setItem("exposure:last_coords", JSON.stringify({ latitude: 37.77, longitude: -122.42 }));
  await AsyncStorage.setItem("exposure:literature_cache", JSON.stringify({ fetchedAt: 1, items: [] }));
}

test("the export holds everything the person entered, by table, and says what it is", async () => {
  await fill();
  const out = await db.exportAllData(NOW);
  expect(out.app).toBe("Exposure Awareness");
  expect(out.format).toBe(1);
  expect(out.exportedAt).toBe(NOW.toISOString());
  expect(Object.keys(out.data).sort()).toEqual(["biomarker_logs", "food_logs", "places", "user_profile"]);
  expect((out.data.food_logs as { food_item: string }[])[0].food_item).toBe("rice");
  expect((out.data.places as { answers: Record<string, unknown> }[])[0].answers.home_gas).toBeDefined();
  expect((out.data.user_profile as { ageYears: number }).ageYears).toBe(34);
});

test("no secret and no cache goes into an export: not the API key, not the last-known location", async () => {
  await fill();
  const text = JSON.stringify(await db.exportAllData(NOW));
  expect(text).not.toMatch(/eak_secret|192\.168|latitude|37\.77|literature/);
});

test("every table the app stores is either exported or registered as service storage: nothing is forgotten by the export", () => {
  const exported = new Set(Object.values(db.KEYS));
  const service = new Set<string>(db.SERVICE_KEYS);
  for (const k of exported) expect(service.has(k)).toBe(false);
  expect([...service].sort()).toEqual(Object.keys(SERVICE_STORAGE).sort()); // the two lists say the same thing
});

test("an empty person exports an empty, valid document", async () => {
  const out = await db.exportAllData(NOW);
  expect(out.data).toEqual({});
  expect(() => JSON.parse(JSON.stringify(out))).not.toThrow();
});

test("deleting everything removes the data, the location cache, the connection settings and the API key", async () => {
  await fill();
  await db.clearEverything();
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
  expect(await db.getUserProfile()).toBeNull();
  expect(await db.getPlaces()).toEqual([]);
  expect((await db.getRecentLogs(50)).food).toEqual([]);
});

describe("learning events keep progress and trim only the rolling record", () => {
  test("a year of daily reads and recall answers never pushes a completed lesson, a paper or a tool out of the record", async () => {
    await db.recordLearning("curriculum:f_hazard_risk", "2026-01-02");
    await db.recordLearning("evidence:pmid_16060722", "2026-01-03");
    await db.recordLearning("tool:risk_translator", "2026-01-04");
    for (let i = 0; i < 420; i++) await db.recordLearning(`daily:wisdom-${i}`, `2026-02-${String((i % 28) + 1).padStart(2, "0")}`);
    for (let i = 0; i < 60; i++) await db.recordLearning(`check:f_hazard_risk.1:${i % 2}`, `2026-03-${String((i % 28) + 1).padStart(2, "0")}-${i}`);
    const events = await db.getLearningEvents();
    const refs = events.map((e) => e.ref);
    expect(refs).toContain("curriculum:f_hazard_risk");
    expect(refs).toContain("evidence:pmid_16060722");
    expect(refs).toContain("tool:risk_translator");
    expect(refs.filter((r) => r.startsWith("daily:")).length).toBe(300);
    expect(refs.filter((r) => r.startsWith("check:f_hazard_risk.1")).length).toBe(12);
  });

  test("trimming keeps the newest of each rolling kind and never reorders", () => {
    const newestFirst = [...Array.from({ length: 5 }, (_, i) => ({ ref: `check:q.1:1`, n: i })), { ref: "curriculum:x", n: 5 }];
    const kept = db.trimLearningEvents(newestFirst);
    expect(kept).toHaveLength(6);
    expect(kept.map((e) => e.n)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
