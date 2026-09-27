// Port of tox-exposure-tool/engine/produce.py. Deliberately does NOT feed the numeric
// score -- see data/produceTiers.json's _meta.principle. Informational only.
import produceTiers from "../data/produceTiers.json";
import type { FoodLog, ProduceSummary } from "./types";
import { phraseMatcher } from "./textMatch";

// One compiled matcher per produce item ("bananas" also finds "banana", and "doorbell" no longer finds "bell").
const watchMatchers = produceTiers.watch_list.map((i) => ({ item: i.item, mentions: phraseMatcher([i.item.split("/")[0].split(" & ")[0], i.item]) }));
const lowerMatchers = produceTiers.lower_typical.map((i) => ({ item: i.item, mentions: phraseMatcher([i.item]) }));

export function tally(foodEntries: Pick<FoodLog, "food_item" | "notes">[]): ProduceSummary {
  const watchHits: Record<string, number> = {};
  const lowerHits: Record<string, number> = {};

  for (const entry of foodEntries) {
    const text = `${entry.food_item ?? ""} ${entry.notes ?? ""}`;
    for (const { item, mentions } of watchMatchers) {
      if (mentions(text)) watchHits[item] = (watchHits[item] ?? 0) + 1;
    }
    for (const { item, mentions } of lowerMatchers) {
      if (mentions(text)) lowerHits[item] = (lowerHits[item] ?? 0) + 1;
    }
  }

  const watchTotal = Object.values(watchHits).reduce((a, b) => a + b, 0);
  const lowerTotal = Object.values(lowerHits).reduce((a, b) => a + b, 0);
  const total = watchTotal + lowerTotal;

  let tip: string | null = null;
  if (total >= 3 && watchTotal / total >= 0.7) {
    const distinctWatch = Object.keys(watchHits).length;
    if (distinctWatch <= 2) {
      tip =
        `Your logged produce leans heavily on ${Object.keys(watchHits).join(", ")} specifically. ` +
        "Rotating in a wider variety (including some lower-tier items like avocado, " +
        "banana, cabbage, or citrus) is a simple way to avoid concentrating exposure " +
        "to any one item's typical residue profile — not a reason to cut what you're eating now.";
    } else {
      tip =
        "Several of your produce picks this week are from the historically " +
        "higher-residue-detection group. A quick produce-wash soak (not just a rinse) " +
        "for these items, or occasionally swapping in a lower-typical item, are both " +
        "low-effort ways to broaden your aggregate exposure profile.";
    }
  }

  return { watch_hits: watchHits, lower_hits: lowerHits, watch_total: watchTotal, lower_total: lowerTotal, tip };
}
