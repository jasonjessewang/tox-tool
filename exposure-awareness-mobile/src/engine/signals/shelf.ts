/**
 * Shelf. Every product you use habitually is read against the app's own stance rules (the same rules the scan screen
 * shows). Each product carries a burden between 0 (nothing flagged) and 1 (at "worth swapping"), growing with the square of
 * how far its signal sits toward that line -- small traces add up slowly, clearly flagged products count in full -- and the
 * value is how much of an anchor's worth of tolerance the shelf leaves:  100 * ANCHOR / (ANCHOR + total burden).
 *
 * Two properties are deliberate. Retiring or swapping away a flagged product can only ever raise the value, and scanning a
 * clean product can never lower it: the score never says "you removed something worth removing and did worse". (The first
 * version averaged burden over the shelf, so retiring a mildly flagged product while heavier ones remained *lowered* the
 * average -- the soak run found it.) And there is no early floor: the old running index hit its floor at a level a typical
 * shelf already exceeds, so a good swap could not show; this one only approaches zero as products pile up.
 */
import { STANCE_THRESHOLDS, type Stance } from "../ingredients/assess";
import { isActive } from "../ingredients/ledger";
import { endOfDay } from "../../util/dates";
import type { ComparisonRead, Signal, SignalContext, SignalResult } from "./types";
import { clamp } from "./decay";
import { msg, tr, trn } from "../../i18n";

/** Products at which the shelf picture is fully confident. */
const FULL_ITEMS = 6;
/** The burden at which the shelf reads half way: about three products' worth of "worth swapping". */
export const ANCHOR = 3;

const STANCE_WORDS: Record<Stance, string> = {
  everyday_ok: msg("reasonable as an everyday item"),
  moderation: msg("fine in moderation"),
  consider_swap: msg("worth swapping when convenient"),
};

/** One product's burden: 0 with nothing flagged, 1 at the "worth swapping" line, growing with the square of its signal. */
export const productBurden = (signal: number) => clamp((signal / STANCE_THRESHOLDS.swap) ** 2, 0, 1);

export const shelfSignal: Signal = {
  key: "shelf",
  label: msg("Shelf"),
  blurb: msg("How the products you use habitually read against the app's rules: flagged products weigh on it, and swapping or retiring them lifts it."),
  defaultWeight: 15,
  sources: ["shelf_change"],
  evaluate({ asOf, data }: SignalContext): SignalResult {
    const at = endOfDay(asOf);
    const rows = data.shelf
      .filter((it) => isActive(it, at))
      .map((it) => data.shelfAssessments.get(it.id))
      .filter((a): a is NonNullable<typeof a> => !!a);
    const n = rows.length;

    const total = rows.reduce((sum, r) => sum + productBurden(r.signal), 0);
    const value = n > 0 ? clamp((100 * ANCHOR) / (ANCHOR + total), 5, 100) : 0;
    const confidence = Math.min(1, n / FULL_ITEMS);

    const ok = rows.filter((r) => r.stance === "everyday_ok").length;
    const moderate = rows.filter((r) => r.stance === "moderation").length;
    const swap = rows.filter((r) => r.stance === "consider_swap").length;
    const read: ComparisonRead = n < 3 ? "not_enough_yet" : value >= 70 ? "on_target" : value >= 45 ? "close" : "room_to_grow";

    const worst = [...rows].filter((r) => r.stance !== "everyday_ok").sort((a, b) => b.signal - a.signal).slice(0, 2);
    const notes: string[] = [];
    if (n > 0 && worst.length > 0) notes.push(tr("Reading highest: {items}.", { items: worst.map((r) => `${tr(r.name)} (${tr(STANCE_WORDS[r.stance])})`).join("; ") }));
    if (n > 0 && worst.length === 0) notes.push(tr("Nothing on your shelf reads as anything but reasonable."));
    notes.push(tr("Swapping a product for one that reads cleaner moves this straight away, and so does retiring one you no longer use. Adding a product that reads clean never lowers it."));

    return {
      key: "shelf",
      value,
      confidence,
      parts: [
        {
          label: tr("Products against the stance rules"),
          basis: "reference_rules",
          measured: n > 0 ? tr("{ok} of {n} reasonable, {moderate} fine in moderation, {swap} worth swapping", { ok, n, moderate, swap }) : tr("nothing on your shelf yet"),
          against: tr("the stance rules: reasonable under {moderation}, worth swapping from {swap}", { moderation: STANCE_THRESHOLDS.moderation, swap: STANCE_THRESHOLDS.swap }),
          ratio: n > 0 ? value / 100 : null,
          read,
        },
      ],
      summary:
        n === 0
          ? tr("Nothing on your shelf yet.")
          : n === 1
            ? tr("{name} reads as {stance}.", { name: tr(rows[0].name), stance: tr(STANCE_WORDS[rows[0].stance]) })
            : trn(ok, "{n} of your {total} products reads as a reasonable everyday item.", "{n} of your {total} products read as reasonable everyday items.", { total: n }),
      notes,
    };
  },
};
