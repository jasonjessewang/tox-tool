/**
 * Exposure fusion + scoring engine.
 *
 * Direct TypeScript port of tox-exposure-tool/engine/scoring.py -- same algorithm, same
 * field names, same design intent. Kept in lockstep deliberately: scoring.test.ts mirrors
 * tests/test_scoring.py's scenarios so behavior can be checked to match, not just "looks
 * similar." One deliberate divergence since the engine soak run (src/sim): free text is matched
 * as whole words with negation (textMatch.ts) rather than as substrings.
 *
 * Design intent (non-fear-based): the point is not to maximize a scary number. Awareness
 * bands use plain, non-alarming language; scores are directional/relative (which category
 * and which recurring items dominate YOUR logged pattern) rather than an absolute
 * toxicological risk measurement, and dose is not modeled. Resilience practices are
 * tracked as their own positive section, never mathematically netted against the
 * exposure score.
 */
import hazardDatabase from "../data/hazardDatabase.json";
import concepts from "../data/concepts.json";
import * as aqiEngine from "./aqi";
import * as produceEngine from "./produce";
import { phraseMatcher } from "./textMatch";
import { isScanEntry } from "./scanNotes";
import type {
  ContentComplexity,
  Substance,
  Concept,
  LogStore,
  AwarenessBand,
  CategorySummary,
  Recommendation,
  ScoreReport,
  Category,
  Effort,
  FoodLog,
  PracticeType,
  AdviceInputs,
  StandingExposure,
} from "./types";
import { msg, tr } from "../i18n";

/**
 * What the lowest band says when too little was logged to mean anything. "Nothing flagged" is only
 * reassuring if something was looked at: the engine soak run had a week with nothing logged at all
 * read "Dialed In". Same key (so colours and tests treat it as the lowest band), honest wording.
 */
const MIN_ENTRIES_FOR_ALL_CLEAR = 3;
export const SPARSE_BAND: AwarenessBand = {
  key: "minimal",
  label: msg("Not enough logged yet"),
  description: msg("Log a few meals, products or air readings and this fills in -- a quiet week here mostly means a quiet log."),
};

export const AWARENESS_BANDS: [number, number, AwarenessBand["key"], string, string][] = [
  [0, 2, "minimal", msg("Dialed In"), msg("Nothing notable flagged in this window.")],
  [2, 6, "low", msg("On Track"), msg("A few things worth knowing about — nothing urgent.")],
  [6, 12, "moderate", msg("Some Room to Improve"), msg("A pattern worth addressing when it's convenient.")],
  [12, 999, "priority", msg("Good Focus Area"), msg("This is where your next change would matter most.")],
];

export const NOVA_LABELS: Record<number, string> = {
  1: msg("Unprocessed / minimally processed"),
  2: msg("Processed culinary ingredient"),
  3: msg("Processed food"),
  4: msg("Ultra-processed food"),
};

export const GENERAL_TIPS: Record<Category, string[]> = {
  food: [
    msg("Favor whole, minimally-processed breakfast foods (eggs, oats, fresh fruit, plain yogurt) over packaged/ultra-processed ones."),
    msg("Rotate breakfast choices day-to-day rather than eating the identical processed product every morning, to avoid concentrating exposure to any single additive."),
  ],
  personal_care: [
    msg("Simplify your routine: fewer, well-chosen products reduce the number of ingredient streams you're exposed to daily."),
    msg("Patch-test new products and give your skin/scalp days off from heavily fragranced items when possible."),
  ],
  environment: [
    msg("Increase fresh-air ventilation where practical (exhaust fans, open windows) in the rooms you spend the most time in."),
    msg("Track recurring symptoms (headache, congestion, skin irritation) alongside location/time to help spot environmental patterns worth raising with facilities management or a physician."),
  ],
};

export const BEHAVIORAL_NOTE = msg(
  "If tracking exposures is driven by anxiety about health outcomes, or you notice the logging itself becoming stressful, that's worth mentioning to a therapist or counselor — behavioral strategies (e.g., CBT-based approaches to health anxiety) can help keep awareness useful rather than distressing."
);

export const RESILIENCE_NOTE = msg(
  "A note on 'detox': popular juice cleanses and similar products don't meaningfully speed up how your liver and kidneys clear chemicals — that's not something you need to do anything special to activate. What the practices below ARE well-supported for is general metabolic, cardiovascular, and mental resilience, and healthier day-to-day behavior patterns — which is a real and worthwhile goal on its own, just not literally a chemical 'flush.' They're tracked separately from your exposure score for that reason."
);

export const PRACTICE_LABELS: Record<string, string> = {
  sleep: msg("Sleep"),
  hydration: msg("Hydration"),
  fasting: msg("Fasting window"),
  exercise: msg("Exercise"),
  screen_free: msg("Screen-free / dopamine reset"),
  grounding_stretching: msg("Grounding / stretching"),
  other: msg("Other practice"),
};

// The two-sided framing this app teaches during onboarding: Quick Wins/Focus items are
// "removing bad" (reducing a specific flagged exposure); everything logged as a practice
// is "adding good" (a positive input, not the absence of a negative one) -- sleep and
// hydration are exactly as legitimate a practice as exercise, not an afterthought.
export const ADDING_GOOD_PRACTICE_TYPES: PracticeType[] = ["sleep", "hydration", "exercise", "grounding_stretching"];

const IMPACT_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

/** The summary at the person's chosen level of detail: "Simple" gets the plain-language one, every other level the full one. */
export function summaryFor(s: Pick<Substance, "summary" | "summary_plain">, level: ContentComplexity): string {
  return level === "simple" && s.summary_plain ? s.summary_plain : s.summary;
}

export function loadHazardDb(): Substance[] {
  return (hazardDatabase as any).substances as Substance[];
}

export function loadConcepts(): Record<string, Concept> {
  const out: Record<string, Concept> = {};
  for (const c of (concepts as any).concepts as Concept[]) out[c.id] = c;
  return out;
}

function textBlob(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

// Whole-word, negation-aware matching (see textMatch.ts). Compiled once per substance list, and the
// per-text result is memoised: the same log entries are re-scored by every rolling window, tab and
// trend, so most calls are repeats.
const matchersFor = new WeakMap<Substance[], { substance: Substance; mentions: (text: string) => boolean }[]>();
const resultsFor = new WeakMap<Substance[], Map<string, Substance[]>>();

function matchSubstances(text: string, substances: Substance[]): Substance[] {
  let memo = resultsFor.get(substances);
  if (!memo) resultsFor.set(substances, (memo = new Map()));
  const known = memo.get(text);
  if (known) return known;

  let matchers = matchersFor.get(substances);
  if (!matchers) {
    matchers = substances.map((s) => ({ substance: s, mentions: phraseMatcher([s.name, ...(s.aliases ?? [])]) }));
    matchersFor.set(substances, matchers);
  }
  const hits = matchers.filter((m) => m.mentions(text)).map((m) => m.substance);
  if (memo.size >= 5000) memo.clear();
  memo.set(text, hits);
  return hits;
}

/** The part of a tip_key before the first colon: a substance id, or "processing" / "produce" / "air_quality". */
export const sourceOf = (tipKey: string) => tipKey.split(":")[0];

/**
 * A substance that stands on the shelf or in a place shows up once in a ranked list, not once per tip: three
 * tips about one shampoo (or one gas stove) are one decision, not three. Marking a tip done moves the list on to the
 * same substance's next open tip. Tips that come from this week's logs are left exactly as they are.
 */
function onePerStandingSubstance(ranked: Recommendation[]): Recommendation[] {
  const seen = new Set<string>();
  return ranked.filter((r) => {
    if (r.origin !== "shelf" && r.origin !== "places") return true;
    const source = sourceOf(r.tip_key);
    if (seen.has(source)) return false;
    seen.add(source);
    return true;
  });
}

function awarenessBand(score: number): AwarenessBand {
  for (const [lo, hi, key, label, description] of AWARENESS_BANDS) {
    if (score >= lo && score < hi) return { key, label, description };
  }
  const [, , key, label, description] = AWARENESS_BANDS[AWARENESS_BANDS.length - 1];
  return { key, label, description };
}

/**
 * `advice` shapes which tips are shown; it never changes the scores, which describe what was logged.
 *  - `standing`: the exposure the shelf carries week after week (see StandingExposure). It feeds
 *    Focus and Quick Wins, so the advice does not go quiet just because nothing flagged was typed
 *    in this week.
 *  - `kept`: sources the person decided to leave alone for now. Their tips stay in the full list
 *    but out of Focus and Quick Wins -- persistent advice needs a way to be answered "no, thanks".
 */
export function scoreLogs(
  logs: LogStore,
  substances: Substance[] = loadHazardDb(),
  completedActionKeys: Set<string> = new Set(),
  advice: AdviceInputs = {}
): ScoreReport {
  const standing = advice.standing ?? [];
  const kept = advice.kept ?? new Set<string>();
  const categoryHits: Record<string, Substance[]> = {};
  const pushHit = (cat: string, s: Substance) => {
    (categoryHits[cat] ??= []).push(s);
  };

  // Scanning a product catalogs it; the shelf ledger tracks how often it is used. A scan entry is
  // not a meal eaten or a product used, so it stays out of the week's logged pattern -- otherwise
  // the same product is counted twice, and the weekly score spikes on every scan.
  const foodEntries = (logs.food ?? []).filter((e) => !isScanEntry(e));
  const productEntries = (logs.products ?? []).filter((e) => !isScanEntry(e));

  for (const entry of foodEntries) {
    const text = textBlob(entry.food_item, entry.meal, entry.notes);
    for (const m of matchSubstances(text, substances)) pushHit(m.category, m);
  }
  for (const entry of productEntries) {
    const text = textBlob(entry.product_name, entry.product_type, entry.ingredients_text, entry.notes);
    for (const m of matchSubstances(text, substances)) pushHit(m.category, m);
  }
  for (const entry of logs.environment ?? []) {
    const text = textBlob(entry.condition_type, entry.location, entry.detail, entry.notes);
    for (const m of matchSubstances(text, substances)) pushHit(m.category, m);
  }

  // --- Air quality (numeric, classified via EPA breakpoints, folded into environment) ---
  const airQualityReadings: ScoreReport["air_quality_readings"] = [];
  let airQualityScore = 0;
  for (const entry of logs.air_quality ?? []) {
    const result = aqiEngine.classify(entry.pollutant, entry.value);
    if (result) {
      airQualityReadings.push({ ...entry, ...result });
      if (result.concern_level >= 1) airQualityScore += result.concern_level;
    }
  }

  // --- NOVA / ultra-processed food tracking (structural, not a substance match) ---
  const processingCounts: Partial<Record<1 | 2 | 3 | 4, number>> = {};
  for (const entry of foodEntries) {
    const level = entry.processing_level;
    if (level) processingCounts[level] = (processingCounts[level] ?? 0) + 1;
  }
  const upfScore = Math.min(6, processingCounts[4] ?? 0);

  // --- Produce diversity (informational only, does not affect score) ---
  const produceSummary = produceEngine.tally(foodEntries);

  // --- Resilience practices (tracked separately, never netted against the score) ---
  const practiceSummary: ScoreReport["practice_summary"] = {};
  for (const entry of logs.practices ?? []) {
    const pt = entry.practice_type ?? "other";
    const bucket = (practiceSummary[pt] ??= { count: 0, total_minutes: 0 });
    bucket.count += 1;
    bucket.total_minutes += entry.duration_minutes ?? 0;
  }

  // --- Aggregate category scores ---
  const categorySummary: Partial<Record<Category, CategorySummary>> = {};
  const allFlagged: Record<string, Substance> = {};
  for (const [category, hits] of Object.entries(categoryHits)) {
    const score = hits.reduce((sum, s) => sum + s.concern_level, 0);
    const counts: Record<string, number> = {};
    for (const s of hits) {
      counts[s.id] = (counts[s.id] ?? 0) + 1;
      allFlagged[s.id] = s;
    }
    const substancesOut = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([sid, cnt]) => ({
        id: sid,
        name: allFlagged[sid].name,
        count: cnt,
        concern_level: allFlagged[sid].concern_level,
      }));
    categorySummary[category as Category] = { score, hit_count: hits.length, substances: substancesOut };
  }
  categorySummary.food ??= { score: 0, hit_count: 0, substances: [] };
  categorySummary.environment ??= { score: 0, hit_count: 0, substances: [] };
  categorySummary.food!.score += upfScore;
  categorySummary.environment!.score += airQualityScore;

  const overallScore = Object.values(categorySummary).reduce((sum, c) => sum + (c?.score ?? 0), 0);
  const entriesLooked = foodEntries.length + productEntries.length + (logs.environment ?? []).length + (logs.air_quality ?? []).length;
  let band = awarenessBand(overallScore);
  if (band.key === "minimal" && entriesLooked < MIN_ENTRIES_FOR_ALL_CLEAR) band = SPARSE_BAND;

  // --- Recommendations (substance-specific, ranked by concern) ---
  const recommendations: Recommendation[] = [];
  const seenTips = new Set<string>();
  const rankedSubstances = Object.values(allFlagged).sort((a, b) => b.concern_level - a.concern_level);
  for (const s of rankedSubstances) {
    (s.mitigation_tips ?? []).forEach((tip, i) => {
      if (seenTips.has(tip)) return;
      const tipKey = `${s.id}:${i}`;
      const count = categorySummary[s.category]?.substances.find((c) => c.id === s.id)?.count ?? 1;
      recommendations.push({
        tip_key: tipKey,
        source: s.name,
        tip,
        concern_level: s.concern_level,
        weight: s.concern_level * count,
        completed: completedActionKeys.has(tipKey),
        action_effort: (s.action_effort as Effort) ?? "medium",
        action_impact: (s.action_impact as Effort) ?? "medium",
        origin: "logs",
      });
      seenTips.add(tip);
    });
  }

  // Standing exposure: shelf products keep a substance on the list whether or not it was mentioned
  // this week. A substance the logs also flagged keeps its log-derived tips and learns which
  // products it lives in; a shelf-only substance contributes tips of its own, weighted by how often
  // its products are used (already in servings per week, the same scale as mentions per week).
  const standingBySubstance = new Map(standing.map((st) => [st.substanceId, st]));
  for (const rec of recommendations) {
    const st = standingBySubstance.get(rec.tip_key.split(":")[0]);
    if (st) {
      rec.via = st.via;
      rec.viaPlaces = st.viaPlaces;
    }
  }
  for (const st of standing) {
    if (allFlagged[st.substanceId]) continue;
    const s = substances.find((x) => x.id === st.substanceId);
    if (!s) continue;
    (s.mitigation_tips ?? []).forEach((tip, i) => {
      if (seenTips.has(tip)) return;
      const tipKey = `${s.id}:${i}`;
      recommendations.push({
        tip_key: tipKey,
        source: s.name,
        tip,
        concern_level: s.concern_level,
        weight: s.concern_level * st.weight,
        completed: completedActionKeys.has(tipKey),
        action_effort: (s.action_effort as Effort) ?? "medium",
        action_impact: (s.action_impact as Effort) ?? "medium",
        origin: st.origin ?? "shelf",
        via: st.via,
        viaPlaces: st.viaPlaces,
      });
      seenTips.add(tip);
    });
  }

  // UPF + produce + air-quality tips feed into the same focus pool with their own tip_keys
  const extraTips: Recommendation[] = [];
  if (upfScore >= 2) {
    const key = "processing:reduce_upf";
    extraTips.push({
      tip_key: key,
      source: msg("Ultra-processed food pattern"),
      tip: msg(
        "You've logged multiple ultra-processed items this week. Swapping just one for a minimally-processed alternative (e.g. plain oats + fruit instead of a packaged pastry) is one of the higher-leverage changes available — it reduces many additives at once rather than targeting a single ingredient."
      ),
      concern_level: 2,
      weight: upfScore,
      completed: completedActionKeys.has(key),
      action_effort: "medium",
      action_impact: "medium",
    });
  }
  if (produceSummary.tip) {
    const key = "produce:diversify";
    extraTips.push({
      tip_key: key,
      source: msg("Produce variety"),
      tip: produceSummary.tip,
      concern_level: 1,
      weight: produceSummary.watch_total,
      completed: completedActionKeys.has(key),
      action_effort: "low",
      action_impact: "low",
    });
  }
  for (const reading of airQualityReadings) {
    if (reading.concern_level >= 2) {
      const key = `air_quality:${reading.pollutant}:${reading.category}`;
      extraTips.push({
        tip_key: key,
        source: tr("Air quality ({location})", { location: reading.location }),
        tip: tr("{category} {pollutant} reading logged ({value} µg/m³). {guidance}", { category: tr(reading.category), pollutant: reading.pollutant, value: reading.value, guidance: tr(reading.guidance) }),
        concern_level: reading.concern_level,
        weight: reading.concern_level * 2,
        completed: completedActionKeys.has(key),
        action_effort: "low",
        action_impact: reading.concern_level >= 3 ? "high" : "medium",
      });
    }
  }

  recommendations.push(...extraTips);
  recommendations.sort((a, b) => b.concern_level - a.concern_level);

  // Advice the person decided to leave alone stays out of Focus and Quick Wins (and stays in `recommendations`).
  const offered = recommendations.filter((r) => !kept.has(sourceOf(r.tip_key)));

  // This Week's Focus: top 3 by weight, incomplete ones prioritized over completed repeats
  const focusPool = [...offered].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return b.weight - a.weight;
  });
  const focusItems = onePerStandingSubstance(focusPool).slice(0, 3);

  // Quick Wins: low-effort actions regardless of concern level.
  const quickWinPool = offered
    .filter((r) => r.action_effort === "low")
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const impactDiff = (IMPACT_RANK[b.action_impact] ?? 2) - (IMPACT_RANK[a.action_impact] ?? 2);
      if (impactDiff !== 0) return impactDiff;
      return b.weight - a.weight;
    });
  const quickWins = onePerStandingSubstance(quickWinPool).slice(0, 3);

  const generalRecs: ScoreReport["general_recommendations"] = [];
  for (const [category, tips] of Object.entries(GENERAL_TIPS) as [Category, string[]][]) {
    const catScore = categorySummary[category]?.score ?? 0;
    if (catScore >= 2) {
      for (const tip of tips) generalRecs.push({ source: `general/${category}`, tip });
    }
  }

  return {
    overall_score: overallScore,
    awareness_band: band,
    category_summary: categorySummary,
    recommendations,
    focus_items: focusItems,
    quick_wins: quickWins,
    general_recommendations: generalRecs,
    behavioral_note: BEHAVIORAL_NOTE,
    resilience_note: RESILIENCE_NOTE,
    air_quality_readings: airQualityReadings,
    processing_counts: processingCounts,
    produce_summary: produceSummary,
    practice_summary: practiceSummary,
    entries_analyzed: {
      food: foodEntries.length,
      products: productEntries.length,
      environment: (logs.environment ?? []).length,
      air_quality: (logs.air_quality ?? []).length,
      practices: (logs.practices ?? []).length,
    },
  };
}

/**
 * What one stretch of logs adds up to, per entry rather than per week: how many entries there were and how
 * many flagged points they carry (the same points scoreLogs sums), broken down by source. The wellness score
 * needs these per day so it can weigh recent days more and ask "how much of what was logged was flagged"
 * instead of "how many flagged points piled up" -- which rewarded logging less. Scans are catalog entries
 * and stay out, exactly as in scoreLogs.
 */
export interface DayTally {
  entries: number;
  points: number;
  /** points by substance id, plus "processing" (ultra-processed food) and "air_quality" */
  by: Record<string, number>;
}

export function tallyDay(logs: LogStore, substances: Substance[] = loadHazardDb()): DayTally {
  const by: Record<string, number> = {};
  let points = 0;
  const add = (source: string, p: number) => {
    if (p <= 0) return;
    points += p;
    by[source] = (by[source] ?? 0) + p;
  };

  const food = (logs.food ?? []).filter((e) => !isScanEntry(e));
  const products = (logs.products ?? []).filter((e) => !isScanEntry(e));
  const environment = logs.environment ?? [];
  const air = logs.air_quality ?? [];

  for (const e of food) {
    for (const s of matchSubstances(textBlob(e.food_item, e.meal, e.notes), substances)) add(s.id, s.concern_level);
    if (e.processing_level === 4) add("processing", 1);
  }
  for (const e of products) {
    for (const s of matchSubstances(textBlob(e.product_name, e.product_type, e.ingredients_text, e.notes), substances)) add(s.id, s.concern_level);
  }
  for (const e of environment) {
    for (const s of matchSubstances(textBlob(e.condition_type, e.location, e.detail, e.notes), substances)) add(s.id, s.concern_level);
  }
  for (const e of air) {
    const result = aqiEngine.classify(e.pollutant, e.value);
    if (result && result.concern_level >= 1) add("air_quality", result.concern_level);
  }
  return { entries: food.length + products.length + environment.length + air.length, points, by };
}
