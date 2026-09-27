// Mirrors the shapes produced by the Python reference implementation
// (tox-exposure-tool/engine/scoring.py) exactly, so the two stay comparable.

export type Effort = "low" | "medium" | "high";
export type Category = "food" | "personal_care" | "environment";

export interface Reference {
  pmid: string;
  title: string;
  journal: string;
  year: string;
  doi: string | null;
  url: string;
}

export interface Regulatory {
  cid: number;
  cas: string | null;
  pubchem_url: string;
  /** EPA's DSSTox Substance ID, when PubChem's synonym list happens to carry it --
   * lets us link out to the EPA CompTOX Chemicals Dashboard (comptox.epa.gov) with a
   * real, government-sourced identifier rather than a fabricated one. Null for
   * substances PubChem doesn't cross-reference to DSSTox. */
  dtxsid?: string | null;
  comptox_url?: string | null;
  ghs_hazards: string[];
}

export interface Substance {
  id: string;
  name: string;
  aliases: string[];
  category: Category;
  concern_level: 1 | 2 | 3;
  summary: string;
  /** The same summary in plain language, for the "Simple" detail level (see summaryFor). Editorial, like `summary`. */
  summary_plain?: string;
  common_sources: string[];
  mitigation_tips: string[];
  pubchem_name: string | null;
  pubmed_query: string;
  action_effort: Effort;
  action_impact: Effort;
  concept_tags: string[];
  technical_note: string;
  references?: Reference[];
  regulatory?: Regulatory | null;
  last_synced?: string;
  /** "Regrettable substitution": this substance is a close relative of the substance(s)
   * named here, often swapped in specifically because the original is restricted or
   * flagged (e.g. a "BPA-free" product using bisphenol S instead of BPA). Peer-reviewed
   * comparisons typically find comparable activity, not a safety improvement -- so the
   * engine treats a match on this substance as relevant to those original ids too. */
  regrettable_substitute_for?: string[];
  /** Inverse of the above, listed on the well-known substance: ids of substances
   * sometimes used to replace this one. Populated for UI display (and kept in sync with
   * the other side's `regrettable_substitute_for` by convention, not by code). */
  known_regrettable_substitutes?: string[];
}

export interface Concept {
  id: string;
  name: string;
  general: string;
  technical: string;
}

export interface FoodLog {
  id: string;
  log_date: string; // ISO yyyy-mm-dd
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  food_item: string;
  processing_level: 1 | 2 | 3 | 4 | null;
  notes: string;
  created_at: string;
}

export interface ProductLog {
  id: string;
  log_date: string;
  product_type: string;
  product_name: string;
  ingredients_text: string;
  notes: string;
  created_at: string;
}

export interface EnvironmentLog {
  id: string;
  log_date: string;
  location: string;
  condition_type: string;
  detail: string;
  notes: string;
  created_at: string;
}

export interface AirQualityLog {
  id: string;
  log_date: string;
  location: string;
  pollutant: "PM2.5" | "PM10";
  value: number;
  source: string;
  notes: string;
  created_at: string;
}

export type PracticeType = "sleep" | "hydration" | "fasting" | "exercise" | "screen_free" | "grounding_stretching" | "other";

export interface PracticeLog {
  id: string;
  log_date: string;
  practice_type: PracticeType;
  duration_minutes: number | null;
  detail: string;
  notes: string;
  created_at: string;
}

export interface BiomarkerLog {
  id: string;
  log_date: string;
  metric: string;
  value: number;
  unit: string;
  source: string;
  notes: string;
  created_at: string;
}

export interface DailyMetricLog {
  id: string;
  log_date: string;
  calories: number | null;
  active_minutes: number | null;
  screen_hours: number | null;
  created_at: string;
}

export interface LogStore {
  food: FoodLog[];
  products: ProductLog[];
  environment: EnvironmentLog[];
  air_quality: AirQualityLog[];
  practices: PracticeLog[];
}

export interface AwarenessBand {
  key: "minimal" | "low" | "moderate" | "priority";
  label: string;
  description: string;
}

export interface CategorySubstanceHit {
  id: string;
  name: string;
  count: number;
  concern_level: number;
}

export interface CategorySummary {
  score: number;
  hit_count: number;
  substances: CategorySubstanceHit[];
}

export interface Recommendation {
  tip_key: string;
  source: string;
  tip: string;
  concern_level: number;
  weight: number;
  completed: boolean;
  action_effort: Effort;
  action_impact: Effort;
  /** Where the tip comes from: what this week's logs mention, what the shelf adds up to, or what a place carries week after week. */
  origin?: "logs" | "shelf" | "places";
  /** The shelf products behind the tip, when it has any. */
  via?: string[];
  /** The places behind the tip ("Home: gas cooking"), when it has any. */
  viaPlaces?: string[];
}

/**
 * Exposure that persists whether or not anything was logged this week: a substance the shelf's
 * habitual products carry, weighted by how often they are used (servings per week, tier-weighted).
 * Built from the ingredient ledger; scoreLogs only reads it, so the engine stays pure.
 */
export interface StandingExposure {
  substanceId: string;
  weight: number;
  /** the shelf products it comes from */
  via: string[];
  /** the places it comes from ("Home: gas cooking") */
  viaPlaces?: string[];
  /** the larger contributor: the shelf (default) or a place */
  origin?: "shelf" | "places";
}

/** Everything beyond this week's logs that shapes which advice is shown. */
export interface AdviceInputs {
  /** What the shelf carries week after week. */
  standing?: StandingExposure[];
  /** Sources (substance ids, "processing", ...) the person decided to leave alone for now. */
  kept?: Set<string>;
}

export interface AirQualityReading extends AirQualityLog {
  category: string;
  aqi_estimate: number;
  color: string;
  guidance: string;
  concern_level: number;
}

export interface ProduceSummary {
  watch_hits: Record<string, number>;
  lower_hits: Record<string, number>;
  watch_total: number;
  lower_total: number;
  tip: string | null;
}

export interface PracticeSummaryEntry {
  count: number;
  total_minutes: number;
}

export type LifeStage = "child" | "adolescent" | "adult" | "older_adult";
export type ContentComplexity = "simple" | "balanced" | "technical";
export type Condition = "asthma" | "kidney" | "liver" | "immunocompromised" | "fragrance_sensitivity";
export type CheckInTime = "off" | "morning" | "midday" | "dinner";

export interface UserProfile {
  ageYears: number | null;
  sex: "female" | "male" | "unspecified" | null;
  weightKg: number | null;
  heightCm: number | null;
  pregnant: boolean;
  breastfeeding: boolean;
  conditions: Condition[];
  contentComplexity: ContentComplexity;
  completedAt: string;
  locationEnabled: boolean;
  checkInTime: CheckInTime;
  /**
   * A short learning moment between screens (and when the app opens). On unless the person turns it off -- absent means on, so profiles
   * saved before this existed behave as they always did.
   */
  learningMoments?: boolean;
}

export type Mood = "good" | "okay" | "rough";

export interface CheckInLog {
  id: string;
  log_date: string;
  mood: Mood | null;
  reflection: string;
  planForTomorrow: string;
  created_at: string;
}

export interface PersonalReason {
  conceptTag: string;
  label: string; // e.g. "Pregnancy", "Kidney condition"
  reason: string; // human-readable, substance-specific
}

export interface ScoreReport {
  overall_score: number;
  awareness_band: AwarenessBand;
  category_summary: Partial<Record<Category, CategorySummary>>;
  recommendations: Recommendation[];
  focus_items: Recommendation[];
  quick_wins: Recommendation[];
  general_recommendations: { source: string; tip: string }[];
  behavioral_note: string;
  resilience_note: string;
  air_quality_readings: AirQualityReading[];
  processing_counts: Partial<Record<1 | 2 | 3 | 4, number>>;
  produce_summary: ProduceSummary;
  practice_summary: Partial<Record<PracticeType, PracticeSummaryEntry>>;
  entries_analyzed: {
    food: number;
    products: number;
    environment: number;
    air_quality: number;
    practices: number;
  };
}
