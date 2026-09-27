/**
 * Matches parsed ingredients against the hazard database. Deliberately stricter than the
 * general log matcher: whole-word matching (so "percent" never flags dry cleaning), no
 * environment-only substances, a denylist of descriptive non-ingredient aliases, and negation
 * handling ("sugar-free", "BPA free", "no added sugar").
 */
import dictionary from "../../data/ingredientDictionary.json";
import { loadHazardDb } from "../scoring";
import type { Substance } from "../types";
import type { ParsedIngredient, Tier } from "./parse";

export interface MatchedSubstance {
  substanceId: string;
  name: string;
  concernLevel: number;
  tier: Tier;
  ingredient: string;
  /** "listed" = named on the label; "possible" = a class term that may contain it (e.g. "fragrance"). */
  confidence: "listed" | "possible";
}

export interface MatchResult {
  matches: MatchedSubstance[];
  unmatched: string[];
}

const TIER_RANK: Record<Tier, number> = { major: 3, minor: 2, trace: 1 };
const INGREDIENT_CATEGORIES = new Set(["food", "personal_care"]);
const IGNORE = new Set((dictionary as { ignore_aliases: string[] }).ignore_aliases);
const BASELINE_POSSIBLE = new Set(["fragrance", "parfum"]);

interface AliasEntry {
  substanceId: string;
  alias: string;
  regex: RegExp;
  possible: boolean;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let cache: { key: Substance[]; entries: AliasEntry[]; eMap: Map<string, string> } | null = null;

function build(substances: Substance[]) {
  if (cache && cache.key === substances) return cache;
  const ids = new Set(substances.filter((s) => INGREDIENT_CATEGORIES.has(s.category)).map((s) => s.id));
  const entries: AliasEntry[] = [];
  const eMap = new Map<string, string>();
  const push = (substanceId: string, alias: string, possible: boolean) => {
    const a = alias.toLowerCase().trim();
    if (a.length < 2 || IGNORE.has(a)) return;
    entries.push({ substanceId, alias: a, possible, regex: new RegExp(`(^|[^a-z0-9])${escape(a)}([^a-z0-9]|$)`) });
  };
  for (const s of substances) {
    if (!ids.has(s.id)) continue;
    push(s.id, s.name.replace(/\s*\(.*\)$/, ""), false);
    for (const a of s.aliases ?? []) push(s.id, a, BASELINE_POSSIBLE.has(a.toLowerCase()));
  }
  for (const d of (dictionary as { synonyms: { substance_id: string; names: string[]; possible_names?: string[]; e_numbers: string[] }[] }).synonyms) {
    if (!ids.has(d.substance_id)) continue;
    for (const n of d.names) push(d.substance_id, n, false);
    for (const n of d.possible_names ?? []) push(d.substance_id, n, true);
    for (const e of d.e_numbers) eMap.set(e.toLowerCase(), d.substance_id);
  }
  cache = { key: substances, entries, eMap };
  return cache;
}

/** True if the alias occurrence is negated: "sugar-free", "free of BPA", "no added sugar", "non-...". */
function negated(text: string, start: number, end: number): boolean {
  const after = text.slice(end, end + 8);
  const before = text.slice(Math.max(0, start - 14), start);
  return /^[\s-]*free\b/.test(after) || /(?:\bno|\bwithout|\bfree of|\bnon)[\s-]*(?:added\s+)?$/.test(before);
}

export function matchIngredients(items: ParsedIngredient[], substances: Substance[] = loadHazardDb()): MatchResult {
  const { entries, eMap } = build(substances);
  const byId = new Map(substances.map((s) => [s.id, s]));
  const best = new Map<string, MatchedSubstance>();
  const matchedItems = new Set<number>();

  items.forEach((item, idx) => {
    const text = ` ${item.name} `.toLowerCase();
    const hits: { id: string; possible: boolean }[] = [];
    if (item.eNumber && eMap.has(item.eNumber)) hits.push({ id: eMap.get(item.eNumber)!, possible: false });
    for (const e of entries) {
      const m = e.regex.exec(text);
      if (!m) continue;
      const start = m.index + m[1].length;
      if (negated(text, start, start + e.alias.length)) continue;
      hits.push({ id: e.substanceId, possible: e.possible });
    }
    for (const h of hits) {
      const s = byId.get(h.id)!;
      const candidate: MatchedSubstance = { substanceId: s.id, name: s.name, concernLevel: s.concern_level, tier: item.tier, ingredient: item.name, confidence: h.possible ? "possible" : "listed" };
      const prev = best.get(s.id);
      const better = !prev || TIER_RANK[candidate.tier] > TIER_RANK[prev.tier] || (TIER_RANK[candidate.tier] === TIER_RANK[prev.tier] && prev.confidence === "possible" && candidate.confidence === "listed");
      if (better) best.set(s.id, candidate);
      matchedItems.add(idx);
    }
  });

  const unmatched = items.filter((it, i) => !matchedItems.has(i) && !it.parent).map((it) => it.name);
  return { matches: [...best.values()].sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || b.concernLevel - a.concernLevel), unmatched };
}
