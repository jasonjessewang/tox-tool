/**
 * The registry: which signals exist, and how every recorded activity factors into the picture.
 *
 * "Every activity factors into the score" is enforced, not promised. ACTIVITY_ROLE has an entry for every ActivityKind
 * (the compiler fails if a kind is added without one), and each entry either feeds one or more signals or says why the
 * activity deliberately does not. STORAGE_ACTIVITY does the same for every AsyncStorage key the app owns, so a new
 * table cannot be added without classifying what is kept in it. registry.test.ts checks both, and scans the source for
 * storage keys that skipped registration.
 */
import type { KEYS } from "../../storage/db";
import type { ActivityKind, Signal, SignalKey } from "./types";
import { exposureSignal } from "./exposure";
import { habitsSignal } from "./habits";
import { validationSignal } from "./validation";
import { shelfSignal } from "./shelf";
import { placesSignal } from "./places";
import { understandingSignal } from "./understanding";
import { msg } from "../../i18n";

/** In display order. */
export const SIGNALS: Signal[] = [exposureSignal, habitsSignal, validationSignal, shelfSignal, placesSignal, understandingSignal];

export const signalByKey = (key: SignalKey): Signal => SIGNALS.find((s) => s.key === key)!;

export type ActivityRole = { feeds: SignalKey[] } | { unscored: string };

export const ACTIVITY_ROLE: Record<ActivityKind, ActivityRole> = {
  food_log: { feeds: ["exposure"] },
  product_log: { feeds: ["exposure"] },
  environment_log: { feeds: ["exposure"] },
  air_quality_log: { feeds: ["exposure"] },
  practice_log: { feeds: ["resilience"] },
  daily_numbers: { feeds: ["resilience"] },
  checkin_log: { feeds: ["resilience"] },
  biomarker_log: { feeds: ["validation"] },
  learning: { feeds: ["learning"] },
  shelf_change: { feeds: ["shelf"] },
  place_check: { feeds: ["places"] },
  place_context: { feeds: ["places"] },
  advice_decision: { unscored: msg("Deciding on a tip changes what the app suggests, not what you are exposed to: the effect shows up when the shelf or your places change.") },
  profile_update: { unscored: msg("Your profile tailors which items matter for you; it is context for every signal, not an activity to be scored.") },
  score_setting: { unscored: msg("Choosing how much each part counts is a preference about the score itself, not something you did.") },
  achievement: { unscored: msg("Badges are derived from the other activities, so scoring them would count the same thing twice.") },
  notification_state: { unscored: msg("Bookkeeping about which alerts were already shown.") },
};

/** Every table the person's activity is stored in, and the kind of activity it holds. */
export const STORAGE_ACTIVITY: Record<keyof typeof KEYS, ActivityKind> = {
  food: "food_log",
  products: "product_log",
  environment: "environment_log",
  air_quality: "air_quality_log",
  practices: "practice_log",
  biomarkers: "biomarker_log",
  checkins: "checkin_log",
  metrics: "daily_numbers",
  learning: "learning",
  shelf: "shelf_change",
  places: "place_check",
  score_weights: "score_setting",
  completed_actions: "advice_decision",
  kept_advice: "advice_decision",
  achievements: "achievement",
  profile: "profile_update",
};

/** Storage that is not the person's activity at all: caches, connection settings, alert bookkeeping. Developer notes, never shown. */
export const SERVICE_STORAGE: Record<string, string> = {
  "exposure:location_alert_state": "Bookkeeping about which alerts were already shown.", // i18n-ignore: developer note
  "exposure:literature_cache": "A cache of recent literature, re-fetched on demand.", // i18n-ignore: developer note
  "exposure:last_coords": "A cache of the last known location, used only for local air-quality lookups.", // i18n-ignore: developer note
  "exposure:backend_config": "Connection settings for the optional backend.", // i18n-ignore: developer note
};

/** The signals an activity feeds; empty when it is deliberately unscored. */
export function signalsFedBy(kind: ActivityKind): SignalKey[] {
  const role = ACTIVITY_ROLE[kind];
  return "feeds" in role ? role.feeds : [];
}
