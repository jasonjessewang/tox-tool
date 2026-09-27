/**
 * Places. The checklist for the spaces a person's days happen in (home, work or school, everyday places) is a set of
 * answers, each compared with a published reference: the EPA, the WHO, the US Surgeon General, or -- where no authority
 * gives a number -- the app's own curated guidance, which the comparison says plainly. The signal is the share of the
 * checked things that meet their reference, weighted by how much the concern matters, how much of the week is spent in the
 * place, and who shares the space, so the hours you spend and the people you live with change what counts.
 *
 * Answers are dated and kept: the score can be read as of an earlier day, and an answer over a year old still counts
 * but carries less evidence, because a home changes (a stove is replaced, a leak is fixed).
 */
import { CURATED, checkById } from "../../data/placeChecks";
import { FRESH_DAYS, answerFreshness, householdNotes, peopleIn, stillToGain, timeFactor, weighPlaces } from "../places/evaluate";
import { clamp } from "./decay";
import type { ComparisonPart, ComparisonRead, Signal, SignalContext, SignalResult } from "./types";

/** Answered comparisons at which the picture of the places is fully confident. */
export const FULL_ANSWERS = 8;
/**
 * While few things have been compared, the value leans toward a typical place (three quarters of the way to every reference met)
 * instead of swinging with the first answer: the lean is worth about one and a half home findings, so it is felt at first and
 * fades as answers accumulate. A fixed amount, so answering more that meets the reference can never lower the value.
 */
export const PRIOR_WEIGHT = 6;
export const PRIOR_CREDIT = 0.75;
const AUTHORITIES: [RegExp, string][] = [
  [/US EPA/, "US EPA"],
  [/WHO/, "WHO"],
  [/Surgeon General/, "US Surgeon General"],
];

/** A comparison is against published guidance when its source names an authority; otherwise it is the app's own curated guidance (the row says how many of each). */
const isPublished = (checkId: string) => checkById(checkId)?.reference.source !== CURATED;
const authoritiesOf = (checkIds: string[]) => {
  const found = new Set<string>();
  for (const id of checkIds) {
    const source = checkById(id)?.reference.source ?? "";
    for (const [re, name] of AUTHORITIES) if (re.test(source)) found.add(name);
  }
  return [...found];
};

const READ_ON_TARGET = 0.8;
const READ_CLOSE = 0.55;
const MIN_FOR_READ = 3;

const readOf = (share: number, count: number): ComparisonRead => (count < MIN_FOR_READ ? "not_enough_yet" : share >= READ_ON_TARGET ? "on_target" : share >= READ_CLOSE ? "close" : "room_to_grow");
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export const placesSignal: Signal = {
  key: "places",
  label: "Places",
  blurb: "How the places you spend your days in compare with published guidance -- weighted by the hours you spend there and who shares them.",
  defaultWeight: 20,
  sources: ["place_check", "place_context"],
  evaluate({ asOf, data }: SignalContext): SignalResult {
    const { scored, unanswered: unknown } = weighPlaces(data.places, data.substances, asOf, data.profile);
    const unanswered = unknown.length;
    const unansweredNames = unknown.slice(0, 3).map((u) => `${u.place.label}: ${u.reading.short}`);

    const total = scored.reduce((s, x) => s + x.weight, 0);
    const credited = scored.reduce((s, x) => s + x.weight * x.credit, 0);
    const value = total > 0 ? clamp((100 * (credited + PRIOR_WEIGHT * PRIOR_CREDIT)) / (total + PRIOR_WEIGHT), 5, 100) : 0;
    const lean = total > 0 ? PRIOR_WEIGHT / (total + PRIOR_WEIGHT) : 0;
    const confidence = Math.min(1, scored.reduce((s, x) => s + answerFreshness(x.ageDays), 0) / FULL_ANSWERS);

    const meets = scored.filter((x) => x.reading.status === "meets").length;
    const attention = scored.filter((x) => x.reading.status === "attention");

    // One comparison per place: how many of its checked things meet the reference, and against what.
    const parts: ComparisonPart[] = [];
    for (const place of data.places) {
      const rows = scored.filter((x) => x.place.id === place.id);
      if (rows.length === 0) continue;
      const w = rows.reduce((s, x) => s + x.weight, 0);
      const share = w > 0 ? rows.reduce((s, x) => s + x.weight * x.credit, 0) / w : 0;
      const ids = rows.map((x) => x.reading.checkId);
      const published = ids.filter(isPublished).length;
      const authorities = authoritiesOf(ids);
      const met = rows.filter((x) => x.reading.status === "meets").length;
      const needs = rows.length - met;
      parts.push({
        label: place.label,
        basis: published > 0 ? "guideline" : "reference_rules",
        measured: `${met} of ${rows.length} checks meet the reference${needs > 0 ? `, ${needs} worth attention` : ""}`,
        against:
          published === 0
            ? "this app's curated guidance (the studies are under Learn)"
            : published === ids.length
              ? `${list(authorities)} guidance`
              : `${list(authorities)} guidance for ${published} of these checks, and this app's curated guidance for the other ${ids.length - published}`,
        ratio: share,
        read: readOf(share, rows.length),
      });
    }
    if (parts.length === 0) {
      parts.push({
        label: "Your places",
        basis: "guideline",
        measured: "no checks answered yet",
        against: "US EPA, WHO and US Surgeon General guidance where they give a number, and this app's curated guidance for the rest",
        ratio: null,
        read: "not_enough_yet",
      });
    }

    const notes: string[] = [];
    const worth = [...attention].sort((a, b) => stillToGain(b) - stillToGain(a)).slice(0, 3);
    if (worth.length > 0) notes.push(`Worth a look first: ${worth.map((x) => `${x.place.label}: ${x.reading.short}`).join("; ")}.`);
    if (scored.length > 0 && attention.length === 0) notes.push("Everything you have checked meets its reference.");
    const amplified = worth.find((x) => x.weight > x.substance.concern_level * timeFactor(x.place) + 1e-9);
    if (amplified) {
      const notesFor = householdNotes(amplified.substance, peopleIn(amplified.place, data.profile));
      const who = notesFor.filter((n) => n.who !== "You").map((n) => `${n.who} (${n.reasons[0].label.toLowerCase()})`);
      if (who.length > 0) notes.push(`${amplified.reading.short[0].toUpperCase()}${amplified.reading.short.slice(1)} at ${amplified.place.label} counts for a little more because ${list(who)} share${who.length === 1 ? "s" : ""} it.`);
    }
    const stale = scored.filter((x) => x.ageDays > FRESH_DAYS).length;
    if (stale > 0) notes.push(`${stale} answer${stale === 1 ? " is" : "s are"} over a year old: a fresh look keeps the comparison current.`);
    if (unanswered > 0) notes.push(`${unanswered} check${unanswered === 1 ? "" : "s"} not answered yet (${unansweredNames.join("; ")}${unanswered > unansweredNames.length ? "; ..." : ""}). Each one you answer fills in the picture.`);
    if (lean > 0.25) notes.push("With only a few things compared so far, this leans toward a typical place so one answer doesn't swing it; it follows your own answers more as you add them.");
    notes.push("Fixing something, or updating an answer, moves this straight away. Spending more of the week in a place, or sharing it with someone it matters more for, makes its findings count for more.");

    return {
      key: "places",
      value,
      confidence,
      parts,
      summary: scored.length === 0 ? "No places checked yet." : `${meets} of ${scored.length} checks across your places meet their reference.`,
      notes,
    };
  },
};
