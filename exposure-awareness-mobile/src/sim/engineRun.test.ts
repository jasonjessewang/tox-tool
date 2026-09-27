/// <reference types="node" />
/**
 * Engine soak run. Opt-in (SIM=1) so the normal suite stays fast:
 *
 *   npm run sim            # all personas, each in its own timezone process, then experiments + report
 *
 * SIM_MODE=persona      runs one persona (SIM_PERSONA, with TZ set by the caller): a baseline run in
 *                       which the person acts on the engine's advice, plus two "twins" with the SAME
 *                       diet that differ only in how thoroughly they log.
 * SIM_MODE=experiments  timezone-independent checks: write-lock concurrency, knowledge-change diffing,
 *                       and how engine reads scale with history length.
 */
import * as fs from "fs";
import * as path from "path";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as db from "../storage/db";
import { getWellnessScore } from "../engine/wellnessState";
import { getFusionReport } from "../engine/fusion";
import { getJourney } from "../engine/journeyState";
import { evaluateAndUnlock } from "../engine/achievements";
import { loadHazardDb } from "../engine/scoring";
import { buildLedger } from "../engine/ingredients/ledger";
import { parseIngredients } from "../engine/ingredients/parse";
import { matchIngredients } from "../engine/ingredients/match";
import { assessProduct } from "../engine/ingredients/assess";
import type { ShelfItem } from "../engine/ingredients/types";
import type { Substance } from "../engine/types";
import { PERSONAS, personaById } from "./personas";
import { PRODUCTS, nutritionOf } from "./catalog";
import { simulate } from "./simulate";

const RUN = process.env.SIM === "1";
const MODE = process.env.SIM_MODE ?? "persona";
const OUT = process.env.SIM_OUT ?? path.join(__dirname, "../../.sim-out");
const SEED = Number(process.env.SIM_SEED ?? 20260925);
const END = process.env.SIM_END ?? "2026-09-25";
const DAYS = Number(process.env.SIM_DAYS ?? 84);

const maybe = RUN ? describe : describe.skip;
const write = (name: string, data: unknown) => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 1));
};

maybe("engine simulation", () => {
  jest.setTimeout(30 * 60 * 1000);

  beforeAll(() => {
    jest.useRealTimers();
    jest.useFakeTimers({
      doNotFake: ["nextTick", "setImmediate", "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout", "queueMicrotask", "hrtime", "performance", "requestAnimationFrame", "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback"],
      now: new Date(`${END}T12:00:00Z`),
    });
  });
  afterAll(() => jest.useRealTimers());

  if (MODE === "persona") {
    const persona = personaById(process.env.SIM_PERSONA ?? "");
    test("persona run (baseline + logging-thoroughness twins)", async () => {
      if (!persona) throw new Error(`SIM_PERSONA must be one of: ${PERSONAS.map((p) => p.id).join(", ")}`);
      if (process.env.TZ !== persona.tz) throw new Error(`Run ${persona.id} with TZ=${persona.tz} (got ${process.env.TZ ?? "unset"}): Jest cannot switch timezone mid-run.`);
      const base = { seed: SEED, days: DAYS, endLocalDate: END };
      const t0 = performance.now();
      const { snapshot, ...baseline } = await simulate(persona, { ...base, adopt: true, label: "baseline", snapshot: true });
      // The app's own storage after the run: load it into a real app (see docs in scripts/sim.sh) to look at a lived-in state.
      if (snapshot) write(`${persona.id}.snapshot.json`, snapshot);
      const thorough = await simulate(persona, { ...base, adopt: false, thoroughOverride: 0.95, label: "thorough" });
      const sparse = await simulate(persona, { ...base, adopt: false, thoroughOverride: 0.3, label: "sparse" });
      write(`${persona.id}.json`, { baseline, thorough, sparse, seconds: Math.round(performance.now() - t0) / 1000 });
      expect(baseline.rows).toHaveLength(DAYS);
    });
  }

  if (MODE === "experiments") {
    test("concurrent writes: the per-key lock keeps every entry; an unlocked read-modify-write loses them", async () => {
      const N = 200;
      await AsyncStorage.clear();
      await Promise.all(Array.from({ length: N }, (_, i) => db.insertFoodLog({ log_date: "2026-01-01", meal: "snack", food_item: `item ${i}`, processing_level: null, notes: "" })));
      const locked = (await db.getRecentLogs(100000)).food.length;

      await AsyncStorage.clear();
      const KEY = "exposure:food_logs";
      const unlockedAppend = async (i: number) => {
        const raw = await AsyncStorage.getItem(KEY);
        const arr = raw ? JSON.parse(raw) : [];
        arr.unshift({ id: String(i) });
        await AsyncStorage.setItem(KEY, JSON.stringify(arr));
      };
      await Promise.all(Array.from({ length: N }, (_, i) => unlockedAppend(i)));
      const unlocked = JSON.parse((await AsyncStorage.getItem(KEY)) as string).length;

      // mixed: 50 existing, then 50 inserts and 25 deletes racing each other
      await AsyncStorage.clear();
      const ids: string[] = [];
      for (let i = 0; i < 50; i++) ids.push((await db.insertFoodLog({ log_date: "2026-01-01", meal: "snack", food_item: `seed ${i}`, processing_level: null, notes: "" })).id);
      await Promise.all([
        ...Array.from({ length: 50 }, (_, i) => db.insertFoodLog({ log_date: "2026-01-02", meal: "snack", food_item: `race ${i}`, processing_level: null, notes: "" })),
        ...ids.slice(0, 25).map((id) => db.deleteLog("food", id)),
      ]);
      const mixed = (await db.getRecentLogs(100000)).food.length;

      // daily numbers: concurrent upserts for different dates must not eat each other
      await AsyncStorage.clear();
      await Promise.all(Array.from({ length: 30 }, (_, i) => db.upsertDailyMetrics({ log_date: `2026-02-${String(i + 1).padStart(2, "0")}`, calories: 2000 + i, active_minutes: 30, screen_hours: 5 })));
      const metrics = (await db.getDailyMetrics(500)).length;

      write("concurrency.json", { N, locked, unlocked, mixed: { expected: 75, got: mixed }, metrics: { expected: 30, got: metrics } });
      expect(locked).toBe(N);
      expect(mixed).toBe(75);
      expect(metrics).toBe(30);
      expect(unlocked).toBeLessThan(N);
    });

    test("knowledge change: what a re-assessment against the current database changes for a user's shelf", () => {
      const current = loadHazardDb();
      const NEW_IDS = new Set(["bisphenol_analogs", "phenoxyethanol"]);
      const before: Substance[] = current
        .filter((s) => !NEW_IDS.has(s.id))
        .map((s) => {
          const { known_regrettable_substitutes: _drop, ...rest } = s;
          return rest as Substance;
        });
      const changed: { product: string; stanceBefore: string; stanceAfter: string; newlyFlagged: string[]; note: string[] }[] = [];
      for (const spec of Object.values(PRODUCTS)) {
        const parsed = parseIngredients(spec.ingredients);
        const mb = matchIngredients(parsed, before);
        const ma = matchIngredients(parsed, current);
        const input = { unmatchedCount: 0, kind: spec.kind, nova: spec.nova, frequency: spec.frequency, profile: null };
        const ab = assessProduct({ ...input, matches: mb.matches, substances: before });
        const aa = assessProduct({ ...input, matches: ma.matches, substances: current });
        const idsB = new Set(mb.matches.map((m) => m.substanceId));
        const newly = ma.matches.filter((m) => !idsB.has(m.substanceId)).map((m) => m.name);
        if (ab.stance !== aa.stance || newly.length > 0) changed.push({ product: spec.name, stanceBefore: ab.stance, stanceAfter: aa.stance, newlyFlagged: newly, note: aa.substitutions.map((s) => `${s.substanceName} ~ ${s.relatedName}`) });
      }
      const ledgerDiff = PERSONAS.map((p) => {
        const items: ShelfItem[] = p.scanPlan.map((key, i) => ({
          id: `${p.id}-${i}`, addedAt: "2026-07-01T00:00:00.000Z", removedAt: null, name: PRODUCTS[key].name, brand: "", kind: PRODUCTS[key].kind, barcode: null, source: "text",
          ingredientsText: PRODUCTS[key].ingredients, nova: PRODUCTS[key].nova, nutrition: nutritionOf(PRODUCTS[key]), frequency: PRODUCTS[key].frequency, servingsPerUse: PRODUCTS[key].servingsPerUse,
        }));
        const now = new Date(`${END}T12:00:00Z`);
        const lb = buildLedger(items, now, before);
        const la = buildLedger(items, now, current);
        return { persona: p.id, indexBefore: lb.index, indexAfter: la.index, newSubstances: la.substances.filter((s) => !lb.substances.some((x) => x.substanceId === s.substanceId)).map((s) => s.name) };
      });
      write("knowledge_change.json", { changed, ledgerDiff });
      expect(changed.length).toBeGreaterThanOrEqual(0);
    });

    test("scaling: how long the Dashboard-load reads take as history grows", async () => {
      const results: { days: number; entries: number; ms: { wellness: number; fusion: number; journey: number; unlock: number } }[] = [];
      for (const days of [90, 365, 730]) {
        await AsyncStorage.clear();
        const food: unknown[] = [], practices: unknown[] = [], metrics: unknown[] = [], checkins: unknown[] = [];
        for (let d = 0; d < days; d++) {
          const date = new Date(Date.UTC(2026, 8, 25 - d)).toISOString().slice(0, 10);
          for (const [i, meal] of (["breakfast", "lunch", "dinner", "snack"] as const).entries()) food.push({ id: `${d}-${i}`, log_date: date, meal, food_item: ["cereal with milk", "salad", "instant noodles", "energy drink"][i], processing_level: null, notes: "", created_at: `${date}T12:00:00.000Z` });
          for (const t of ["sleep", "hydration", "exercise"]) practices.push({ id: `${d}-${t}`, log_date: date, practice_type: t, duration_minutes: 30, detail: "", notes: "", created_at: `${date}T20:00:00.000Z` });
          metrics.push({ id: `m${d}`, log_date: date, calories: 2000, active_minutes: 30, screen_hours: 5, created_at: `${date}T21:00:00.000Z` });
          checkins.push({ id: `c${d}`, log_date: date, mood: "good", reflection: "", planForTomorrow: "", created_at: `${date}T21:00:00.000Z` });
        }
        await AsyncStorage.setItem("exposure:food_logs", JSON.stringify(food));
        await AsyncStorage.setItem("exposure:practice_logs", JSON.stringify(practices));
        await AsyncStorage.setItem("exposure:daily_metrics", JSON.stringify(metrics));
        await AsyncStorage.setItem("exposure:checkin_logs", JSON.stringify(checkins));
        const time = async (fn: () => Promise<unknown>) => { const t0 = performance.now(); await fn(); return Math.round(performance.now() - t0); };
        results.push({ days, entries: food.length + practices.length + metrics.length + checkins.length, ms: { wellness: await time(() => getWellnessScore()), fusion: await time(() => getFusionReport()), journey: await time(() => getJourney()), unlock: await time(() => evaluateAndUnlock()) } });
      }
      write("scaling.json", results);
      expect(results).toHaveLength(3);
    });
  }
});
