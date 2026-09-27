/**
 * Barcode -> product via Open Food Facts / Open Beauty Facts (free, keyless, community
 * databases; ODbL). Coverage is uneven, so "not found" is a normal outcome, never an error.
 */
import { EMPTY_NUTRITION, type Nutrition } from "../engine/ingredients/parse";
import type { ProductKind } from "../engine/ingredients/types";

export type { ProductKind };

export interface ScannedProduct {
  barcode: string;
  kind: ProductKind;
  name: string;
  brand: string;
  ingredients: string;
  nova: 1 | 2 | 3 | 4 | null;
  /** Declared per-serving amounts when the database has them. */
  nutrition: Nutrition | null;
  /** Database amounts per 100 g -- scaled by the user's real serving. */
  nutritionPer100g: Nutrition | null;
  servingGrams: number | null;
}

const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

function nutrimentsAt(nm: Record<string, unknown> | undefined, suffix: "_100g" | "_serving"): Nutrition | null {
  if (!nm) return null;
  const g = (k: string) => n(nm[`${k}${suffix}`]);
  const mg = (k: string) => (g(k) === null ? null : g(k)! * 1000);
  const out: Nutrition = {
    ...EMPTY_NUTRITION,
    calories: g("energy-kcal"), totalFatG: g("fat"), satFatG: g("saturated-fat"), cholesterolMg: mg("cholesterol"), sodiumMg: mg("sodium"),
    carbsG: g("carbohydrates"), fiberG: g("fiber"), totalSugarsG: g("sugars"), addedSugarsG: g("added-sugars"), proteinG: g("proteins"),
  };
  const found = [out.calories, out.totalFatG, out.satFatG, out.sodiumMg, out.carbsG, out.totalSugarsG, out.proteinG].filter((v) => v !== null).length;
  return found >= 2 ? out : null;
}

/** Per-serving nutrition for a real serving size, from database per-100 g values. */
export function scaleNutrition(per100g: Nutrition, grams: number): Nutrition {
  const f = (v: number | null) => (v === null ? null : Math.round(((v * grams) / 100) * 10) / 10);
  return { ...per100g, servingGrams: grams, servingLabel: `${grams} g`, calories: f(per100g.calories), totalFatG: f(per100g.totalFatG), satFatG: f(per100g.satFatG), cholesterolMg: f(per100g.cholesterolMg), sodiumMg: f(per100g.sodiumMg), carbsG: f(per100g.carbsG), fiberG: f(per100g.fiberG), totalSugarsG: f(per100g.totalSugarsG), addedSugarsG: f(per100g.addedSugarsG), proteinG: f(per100g.proteinG) };
}

export function normalizeBarcode(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

export function parseProduct(json: any, barcode: string, kind: ProductKind): ScannedProduct | null {
  const p = json?.product;
  if (!p || json?.status === 0) return null;
  const name = String(p.product_name ?? "").trim();
  // Prefer the English list: the substance matcher works on English ingredient names.
  const ingredients = String(p.ingredients_text_en || p.ingredients_text || "").trim();
  if (!name && !ingredients) return null;
  const nova = [1, 2, 3, 4].includes(Number(p.nova_group)) ? (Number(p.nova_group) as 1 | 2 | 3 | 4) : null;
  const servingGrams = n(p.serving_quantity) ?? (String(p.serving_size ?? "").match(/(\d+(?:\.\d+)?)\s*g\b/i) ? parseFloat(String(p.serving_size).match(/(\d+(?:\.\d+)?)\s*g\b/i)![1]) : null);
  return {
    barcode, kind, name: name || "Unnamed product", brand: String(p.brands ?? "").split(",")[0].trim(), ingredients, nova,
    nutrition: nutrimentsAt(p.nutriments, "_serving"), nutritionPer100g: nutrimentsAt(p.nutriments, "_100g"), servingGrams,
  };
}

export async function lookupProduct(barcode: string, kind: ProductKind): Promise<ScannedProduct | null> {
  const host = kind === "food" ? "world.openfoodfacts.org" : "world.openbeautyfacts.org";
  try {
    const res = await fetch(`https://${host}/api/v2/product/${barcode}.json?fields=product_name,brands,ingredients_text,ingredients_text_en,nova_group,nutriments,serving_size,serving_quantity`, {
      headers: { "User-Agent": "exposure-awareness-mobile/1.0 (personal-use app)" },
    });
    if (!res.ok) return null;
    return parseProduct(await res.json(), barcode, kind);
  } catch {
    return null;
  }
}
