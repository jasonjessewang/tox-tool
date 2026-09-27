/**
 * The running intake ledger: what your habitual products add up to.
 *
 * Two honest tiers of quantification:
 *  - Nutrients (calories, sodium, added sugars...) come from declared label amounts, so they are
 *    real per-day estimates, shown against FDA reference values.
 *  - Substances are NOT dosed -- labels don't say how much of an additive is inside. They are
 *    tracked as exposure FREQUENCY (servings per week) and an amount-tier-weighted relative
 *    index. The trend of that index is meaningful; its absolute value is not a dose.
 * Everything is recomputed from the stored ingredient text, so improvements to the matcher
 * and database apply retroactively to the whole history.
 */
import { loadConcepts, loadHazardDb } from "../scoring";
import { NUTRIENTS } from "../../data/dailyValues";
import type { StandingExposure, Substance } from "../types";
import { parseIngredients } from "./parse";
import { matchIngredients, type MatchedSubstance } from "./match";
import { FREQUENCY_INFO, type ShelfItem } from "./types";

const TIER_WEIGHT = { major: 1, minor: 0.5, trace: 0.2 } as const;

export interface SubstanceIntake {
  substanceId: string;
  name: string;
  concernLevel: number;
  servingsPerWeek: number;
  weighted: number;
  possibleOnly: boolean;
  sources: { itemId: string; name: string; weighted: number }[];
}

export interface NutrientIntake {
  key: string;
  label: string;
  unit: string;
  perDay: number;
  dv: number;
  pctDv: number;
  limitNutrient: boolean;
}

export interface Ledger {
  itemCount: number;
  foodCount: number;
  nutrients: NutrientIntake[];
  nutrientCoverage: { withNutrition: number; foodItems: number };
  substances: SubstanceIntake[];
  themes: { tag: string; name: string; weighted: number }[];
  index: number;
}

export const isActive = (it: ShelfItem, at: Date) => new Date(it.addedAt) <= at && (it.removedAt === null || new Date(it.removedAt) > at);

export const weeklyServings = (it: ShelfItem) => FREQUENCY_INFO[it.frequency].perWeek * it.servingsPerUse;

export function matchesFor(it: ShelfItem, substances?: Substance[]): MatchedSubstance[] {
  return matchIngredients(parseIngredients(it.ingredientsText), substances).matches;
}

export function buildLedger(items: ShelfItem[], at: Date = new Date(), substances: Substance[] = loadHazardDb()): Ledger {
  const active = items.filter((i) => isActive(i, at));
  const byId = new Map(substances.map((s) => [s.id, s]));
  const concepts = loadConcepts();

  const nutrientSums: Record<string, number> = {};
  let withNutrition = 0;
  const foodItems = active.filter((i) => i.kind === "food");
  for (const it of foodItems) {
    if (!it.nutrition) continue;
    withNutrition++;
    for (const n of NUTRIENTS) {
      const v = it.nutrition[n.key];
      if (typeof v === "number") nutrientSums[n.key] = (nutrientSums[n.key] ?? 0) + (v * weeklyServings(it)) / 7;
    }
  }
  const nutrients: NutrientIntake[] = NUTRIENTS.filter((n) => nutrientSums[n.key] !== undefined).map((n) => ({
    key: n.key, label: n.label, unit: n.unit, perDay: Math.round(nutrientSums[n.key] * 10) / 10, dv: n.dv,
    pctDv: Math.round((nutrientSums[n.key] / n.dv) * 100), limitNutrient: n.limitNutrient,
  }));

  const acc = new Map<string, SubstanceIntake>();
  for (const it of active) {
    const wk = weeklyServings(it);
    for (const m of matchesFor(it, substances)) {
      const w = wk * TIER_WEIGHT[m.tier] * (m.confidence === "possible" ? 0.6 : 1);
      const cur = acc.get(m.substanceId) ?? { substanceId: m.substanceId, name: m.name, concernLevel: m.concernLevel, servingsPerWeek: 0, weighted: 0, possibleOnly: true, sources: [] };
      cur.servingsPerWeek += wk;
      cur.weighted += w;
      if (m.confidence === "listed") cur.possibleOnly = false;
      cur.sources.push({ itemId: it.id, name: it.name, weighted: w });
      acc.set(m.substanceId, cur);
    }
  }
  const substancesOut = [...acc.values()]
    .map((s) => ({ ...s, servingsPerWeek: Math.round(s.servingsPerWeek * 10) / 10, weighted: Math.round(s.weighted * 100) / 100, sources: s.sources.sort((a, b) => b.weighted - a.weighted) }))
    .sort((a, b) => b.concernLevel * b.weighted - a.concernLevel * a.weighted);

  const themeAcc = new Map<string, number>();
  for (const s of substancesOut) for (const tag of byId.get(s.substanceId)?.concept_tags ?? []) themeAcc.set(tag, (themeAcc.get(tag) ?? 0) + s.weighted);
  const themes = [...themeAcc.entries()].map(([tag, weighted]) => ({ tag, name: concepts[tag]?.name ?? tag, weighted: Math.round(weighted * 100) / 100 })).sort((a, b) => b.weighted - a.weighted);

  const index = Math.round(substancesOut.reduce((sum, s) => sum + s.concernLevel * s.weighted, 0) * 10) / 10;
  return { itemCount: active.length, foodCount: foodItems.length, nutrients, nutrientCoverage: { withNutrition, foodItems: foodItems.length }, substances: substancesOut, themes, index };
}

/** What the shelf carries week after week, in the form scoreLogs reads to keep advice alive between logs. */
export function standingFromLedger(ledger: Ledger): StandingExposure[] {
  return ledger.substances.map((s) => ({ substanceId: s.substanceId, weight: s.weighted, via: s.sources.map((x) => x.name) }));
}

/** Weekly exposure-index history, oldest first, so the trend (not just today) is visible. */
export function weeklyIndexSeries(items: ShelfItem[], weeks = 8, now: Date = new Date(), substances?: Substance[]): { label: string; index: number; items: number }[] {
  return Array.from({ length: weeks }, (_, i) => {
    const at = new Date(now.getTime() - (weeks - 1 - i) * 7 * 86400000);
    const l = buildLedger(items, at, substances);
    return { label: `${at.getMonth() + 1}/${at.getDate()}`, index: l.index, items: l.itemCount };
  });
}
