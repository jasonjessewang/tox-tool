/**
 * Logged exposure pattern. Compared with the app's reference bands, per entry: of what you log, how much carries
 * something flagged? Counting per entry (rather than piling up flagged points over a week) means logging more never
 * counts against you -- the old weekly point total made a thorough logger look worse than someone who wrote nothing down.
 * Days count for less as they recede (decay.ts), and the signal says how much it has to go on.
 */
import type { ComparisonPart, ComparisonRead, Signal, SignalContext, SignalResult } from "./types";
import { ageOf, clamp, decay } from "./decay";

/** value = 100 - SLOPE * (flagged points per entry). Continuous with the old 100 - 4 * weekly points at ~20 entries a week. */
const SLOPE = 80;
/** Decayed entries at which the signal is ~63% confident. */
const FULL_MASS = 8;
/**
 * With only a few entries one meal could swing the reading wildly, so it starts from a typical pattern worth PRIOR_MASS
 * entries and moves toward the person's own as they log: a small-sample estimate is shrunk toward a sensible middle instead
 * of trusted outright. PRIOR_DENSITY is the bottom of the app's "moderate" band.
 */
const PRIOR_MASS = 6;
const PRIOR_DENSITY = 0.2;
/** The app's reference bands, in flagged points per entry. */
export const LIGHT_DENSITY = 0.15;
export const MODERATE_DENSITY = 0.35;

const SOURCE_NAMES: Record<string, string> = { processing: "ultra-processed food", air_quality: "air-quality readings" };

export const exposureSignal: Signal = {
  key: "exposure",
  label: "Logged exposure pattern",
  blurb: "Of what you log, how much carries something flagged -- per entry, so logging more never counts against you.",
  defaultWeight: 25,
  sources: ["food_log", "product_log", "environment_log", "air_quality_log"],
  evaluate({ asOf, data }: SignalContext): SignalResult {
    let mass = 0;
    let points = 0;
    const by: Record<string, number> = {};
    for (const [day, tally] of data.days) {
      const w = decay(ageOf(day, asOf));
      if (w === 0) continue;
      mass += tally.entries * w;
      points += tally.points * w;
      for (const [source, p] of Object.entries(tally.by)) by[source] = (by[source] ?? 0) + p * w;
    }

    const density = mass > 0 ? points / mass : 0;
    const leaned = mass > 0 ? (points + PRIOR_MASS * PRIOR_DENSITY) / (mass + PRIOR_MASS) : 0;
    const value = mass > 0 ? clamp(100 - SLOPE * leaned, 5, 100) : 0;
    const confidence = mass > 0 ? 1 - Math.exp(-mass / FULL_MASS) : 0;

    const read: ComparisonRead = confidence < 0.15 ? "not_enough_yet" : leaned < LIGHT_DENSITY ? "on_target" : leaned < MODERATE_DENSITY ? "close" : "room_to_grow";
    const part: ComparisonPart = {
      label: "Flagged points per entry",
      basis: "reference_rules",
      measured: mass > 0 ? `${(density * 10).toFixed(1)} per 10 entries, from about ${Math.max(1, Math.round(mass))} recent ${Math.max(1, Math.round(mass)) === 1 ? "entry" : "entries"}` : "no entries yet",
      against: `the reference bands: under ${(LIGHT_DENSITY * 10).toFixed(1)} per 10 entries reads as light, under ${(MODERATE_DENSITY * 10).toFixed(1)} as moderate`,
      ratio: mass > 0 ? value / 100 : null,
      read,
    };

    const nameOf = (id: string) => SOURCE_NAMES[id] ?? data.substances.find((s) => s.id === id)?.name.replace(/\s*\(.*\)$/, "") ?? id;
    const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => nameOf(id));
    const notes: string[] = [];
    if (mass > 0 && top.length > 0) notes.push(`What was flagged most: ${top.join(", ")}.`);
    if (mass > 0 && top.length === 0) notes.push("Nothing flagged in what you've logged lately.");
    if (mass > 0 && mass < 12) notes.push(`With only about ${Math.max(1, Math.round(mass))} recent ${Math.max(1, Math.round(mass)) === 1 ? "entry" : "entries"} the reading leans toward a typical pattern, so one meal can't swing it; it follows yours more closely as you log.`);
    notes.push("Recent days count more than older ones. Scans are kept out here -- your shelf covers them.");

    const summary =
      confidence < 0.15
        ? "Too few entries to read a pattern yet."
        : top.length === 0
          ? "Nothing flagged in what you've logged lately."
          : `About ${(density * 10).toFixed(1)} flagged points per 10 recent entries -- ${read === "on_target" ? "light" : read === "close" ? "moderate" : "worth a look"}.`;

    return { key: "exposure", value, confidence, parts: [part], summary, notes };
  },
};
