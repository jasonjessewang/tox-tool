/**
 * Ingredient-list and nutrition-facts parsing. Input is either clean text (a product database
 * or something the user typed/pasted) or noisy OCR output, so everything here is tolerant and
 * conservative: it returns fewer, correct fields rather than guessing.
 *
 * Labels list ingredients in descending order by weight, so position is a usable (rough)
 * proxy for how much of something is in the product -- and "contains 2% or less of" marks the
 * trace tail. That proxy is what lets the engine treat a main ingredient differently from a
 * trace one.
 */
export type Tier = "major" | "minor" | "trace";

export interface ParsedIngredient {
  raw: string;
  name: string;
  position: number; // order among top-level ingredients
  tier: Tier;
  percent: number | null;
  eNumber: string | null;
  parent: string | null;
}

const STOP = /\b(?:contains\s*:|contains\s+(?!\d|one or more|less than|and less)(?=[a-z])|allergen(?:s)?\s*(?:information|advice)?\s*:|may contain|manufactured (?:by|in|for)|distributed by|produced (?:by|in)|packed (?:by|in)|nutrition facts|supplement facts|best before|net (?:wt|weight)|directions)/i;
const TRACE_MARKER = /\b(?:(?:contains|less than|and less than)\s+\d+(?:\.\d+)?\s*%\s*(?:or less)?\s*(?:of)?\s*(?:the following)?|contains one or more of the following)\s*:?/i;

function clean(text: string): string {
  return text
    .replace(/-\s*\n\s*/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** The ingredient list out of a whole label's text, or the whole text if there's no "Ingredients:" header. */
export function extractIngredientsSection(text: string): string {
  const t = clean(text);
  const m = t.match(/\bingredients?\s*[:\-]\s*/i);
  const from = m ? t.slice(m.index! + m[0].length) : t;
  const stop = from.search(STOP);
  return (stop >= 0 ? from.slice(0, stop) : from).replace(/\.\s*$/, "").trim();
}

function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    if (ch === ")" || ch === "]" || ch === "}") depth = Math.max(0, depth - 1);
    if ((ch === "," || ch === ";") && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

function baseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(?\s*\d+(?:[.,]\d+)?\s*%\s*\)?/g, " ")
    .replace(/^(?:and|or|contains|organic|natural|artificial flavou?rs?\s+and)\s+/i, "")
    .replace(/[*.•]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findPercent(s: string): number | null {
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*%/);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

function findE(s: string): string | null {
  const m = s.toLowerCase().match(/\be[\s-]?(\d{3,4}[a-z]?)\b/);
  return m ? `e${m[1]}` : null;
}

function tierFor(position: number, percent: number | null, afterMarker: boolean): Tier {
  if (afterMarker) return "trace";
  if (percent !== null) return percent >= 5 ? "major" : percent >= 2 ? "minor" : "trace";
  if (position < 3) return "major";
  if (position < 7) return "minor";
  return "trace";
}

export function parseIngredients(text: string): ParsedIngredient[] {
  let body = extractIngredientsSection(text);
  if (!body) return [];

  let tail = "";
  const marker = body.match(TRACE_MARKER);
  if (marker && marker.index !== undefined) {
    tail = body.slice(marker.index + marker[0].length);
    body = body.slice(0, marker.index);
  }

  const out: ParsedIngredient[] = [];
  let position = 0;
  const add = (segment: string, afterMarker: boolean) => {
    for (const part of splitTopLevel(segment)) {
      const paren = part.match(/^(.*?)[(\[]\s*(.*)[)\]]\s*\.?$/);
      const head = paren ? paren[1] : part;
      const parentName = baseName(head);
      const percent = findPercent(part);
      const tier = tierFor(position, percent, afterMarker);
      if (parentName) out.push({ raw: part, name: parentName, position, tier, percent, eNumber: findE(head), parent: null });
      if (paren) {
        for (const child of splitTopLevel(paren[2])) {
          const name = baseName(child);
          if (name && !/^\d+$/.test(name)) out.push({ raw: child, name, position, tier, percent: findPercent(child), eNumber: findE(child), parent: parentName || null });
        }
      }
      position++;
    }
  };
  add(body, false);
  if (tail) add(tail, true);
  return out;
}

// ---------------------------------------------------------------------------------------

export interface Nutrition {
  servingLabel: string | null;
  servingGrams: number | null;
  servingsPerContainer: number | null;
  calories: number | null;
  totalFatG: number | null;
  satFatG: number | null;
  cholesterolMg: number | null;
  sodiumMg: number | null;
  carbsG: number | null;
  fiberG: number | null;
  totalSugarsG: number | null;
  addedSugarsG: number | null;
  proteinG: number | null;
}

export const EMPTY_NUTRITION: Nutrition = {
  servingLabel: null, servingGrams: null, servingsPerContainer: null, calories: null, totalFatG: null, satFatG: null,
  cholesterolMg: null, sodiumMg: null, carbsG: null, fiberG: null, totalSugarsG: null, addedSugarsG: null, proteinG: null,
};

const num = (s: string) => parseFloat(s.replace(",", "."));

/** grams-equivalent value following a label, e.g. "sodium 160mg" -> 160 (mg). Requires the unit -- OCR often mangles "g" into "9". */
function amount(t: string, label: RegExp, unit: "g" | "mg"): number | null {
  const m = t.match(new RegExp(label.source + "\\s*[:\\s]*\\s*(<?\\s*\\d+(?:[.,]\\d+)?)\\s*(mg|mcg|g)\\b", "i"));
  if (!m) return null;
  const v = num(m[1].replace("<", "").trim());
  const u = m[2].toLowerCase();
  if (unit === "g") return u === "g" ? v : u === "mg" ? v / 1000 : v / 1e6;
  return u === "mg" ? v : u === "g" ? v * 1000 : v / 1000;
}

export function parseNutritionText(text: string): Nutrition | null {
  const t = clean(text).toLowerCase();
  const n: Nutrition = { ...EMPTY_NUTRITION };

  const serving = t.match(/serving size\s*[:\s]*(.{0,40}?)(?=\s(?:servings|amount|calories)|$)/);
  if (serving) {
    n.servingLabel = serving[1].trim() || null;
    const g = serving[1].match(/\(?\s*(\d+(?:[.,]\d+)?)\s*g\s*\)?/);
    if (g) n.servingGrams = num(g[1]);
  }
  const spc = t.match(/(?:about\s*)?(\d+(?:[.,]\d+)?)\s*servings?\s*per\s*container/) ?? t.match(/servings?\s*per\s*container\s*[:\s]*(?:about\s*)?(\d+(?:[.,]\d+)?)/);
  if (spc) n.servingsPerContainer = num(spc[1]);

  const cal = t.match(/calories\s*[:\s]*(\d{1,4})\b/) ?? t.match(/(\d{1,4})\s*kcal/);
  if (cal) n.calories = parseInt(cal[1], 10);

  n.totalFatG = amount(t, /total fat/, "g");
  n.satFatG = amount(t, /saturated fat/, "g");
  n.cholesterolMg = amount(t, /cholesterol/, "mg");
  n.sodiumMg = amount(t, /sodium/, "mg");
  n.carbsG = amount(t, /total carbohydrates?/, "g");
  n.fiberG = amount(t, /dietary fiber/, "g");
  n.totalSugarsG = amount(t, /total sugars/, "g");
  const included = t.match(/includes\s*(\d+(?:[.,]\d+)?)\s*g\s*added sugars/);
  n.addedSugarsG = included ? num(included[1]) : amount(t, /added sugars/, "g");
  n.proteinG = amount(t, /protein/, "g");

  const found = [n.calories, n.totalFatG, n.satFatG, n.cholesterolMg, n.sodiumMg, n.carbsG, n.fiberG, n.totalSugarsG, n.addedSugarsG, n.proteinG].filter((v) => v !== null).length;
  return found >= 2 ? n : null;
}

/** One pass over label text (possibly from two photos): ingredients and nutrition, each optional. */
export function parseLabelText(text: string): { ingredientsText: string; nutrition: Nutrition | null } {
  const hasHeader = /\bingredients?\s*[:\-]/i.test(text);
  return { ingredientsText: hasHeader ? extractIngredientsSection(text) : "", nutrition: parseNutritionText(text) };
}
