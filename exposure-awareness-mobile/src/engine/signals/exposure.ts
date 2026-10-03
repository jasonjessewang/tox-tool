/**
 * Logged exposure pattern. Compared with the app's reference bands, per entry: of what you log, how much carries
 * something flagged? Counting per entry (rather than piling up flagged points over a week) means logging more never
 * counts against you -- the old weekly point total made a thorough logger look worse than someone who wrote nothing down.
 * Days count for less as they recede (decay.ts), and the signal says how much it has to go on.
 */
import type { ComparisonPart, ComparisonRead, Signal, SignalContext, SignalResult } from "./types";
import { ageOf, clamp, decay } from "./decay";
import { listWords, msg, tr, trn } from "../../i18n";

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

const SOURCE_NAMES: Record<string, string> = { processing: msg("ultra-processed food"), air_quality: msg("air-quality readings") };

export const exposureSignal: Signal = {
  key: "exposure",
  label: msg("Logged exposure pattern"),
  blurb: msg("Of what you log, how much carries something flagged -- per entry, so logging more never counts against you."),
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
      label: tr("Flagged points per entry"),
      basis: "reference_rules",
      measured: mass > 0 ? trn(Math.max(1, Math.round(mass)), "{points} per 10 entries, from about {n} recent entry", "{points} per 10 entries, from about {n} recent entries", { points: (density * 10).toFixed(1) }) : tr("no entries yet"),
      against: tr("the reference bands: under {light} per 10 entries reads as light, under {moderate} as moderate", { light: (LIGHT_DENSITY * 10).toFixed(1), moderate: (MODERATE_DENSITY * 10).toFixed(1) }),
      ratio: mass > 0 ? value / 100 : null,
      read,
    };

    const nameOf = (id: string) => { const name = SOURCE_NAMES[id] ?? data.substances.find((s) => s.id === id)?.name; return name ? tr(name).replace(/\s*[(（].*[)）]$/, "") : id; };
    const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => nameOf(id));
    const notes: string[] = [];
    if (mass > 0 && top.length > 0) notes.push(tr("What was flagged most: {items}.", { items: listWords(top) }));
    if (mass > 0 && top.length === 0) notes.push(tr("Nothing flagged in what you've logged lately."));
    if (mass > 0 && mass < 12) notes.push(trn(Math.max(1, Math.round(mass)), "With only about {n} recent entry the reading leans toward a typical pattern, so one meal can't swing it; it follows yours more closely as you log.", "With only about {n} recent entries the reading leans toward a typical pattern, so one meal can't swing it; it follows yours more closely as you log."));
    notes.push(tr("Recent days count more than older ones. Scans are kept out here -- your shelf covers them."));

    const summary =
      confidence < 0.15
        ? tr("Too few entries to read a pattern yet.")
        : top.length === 0
          ? tr("Nothing flagged in what you've logged lately.")
          : read === "on_target"
            ? tr("About {points} flagged points per 10 recent entries -- light.", { points: (density * 10).toFixed(1) })
            : read === "close"
              ? tr("About {points} flagged points per 10 recent entries -- moderate.", { points: (density * 10).toFixed(1) })
              : tr("About {points} flagged points per 10 recent entries -- worth a look.", { points: (density * 10).toFixed(1) });

    return { key: "exposure", value, confidence, parts: [part], summary, notes };
  },
};
