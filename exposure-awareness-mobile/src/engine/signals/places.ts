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
import { capitalize, listWords, msg, tr, trn } from "../../i18n";

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
  [/US EPA/, msg("US EPA")],
  [/WHO/, "WHO"],
  [/Surgeon General/, msg("US Surgeon General")],
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

export const placesSignal: Signal = {
  key: "places",
  label: msg("Places"),
  blurb: msg("How the places you spend your days in compare with published guidance -- weighted by the hours you spend there and who shares them."),
  defaultWeight: 20,
  sources: ["place_check", "place_context"],
  evaluate({ asOf, data }: SignalContext): SignalResult {
    const { scored, unanswered: unknown } = weighPlaces(data.places, data.substances, asOf, data.profile);
    const unanswered = unknown.length;
    const unansweredNames = unknown.slice(0, 3).map((u) => `${tr(u.place.label)}: ${tr(u.reading.short)}`);

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
        label: tr(place.label),
        basis: published > 0 ? "guideline" : "reference_rules",
        measured:
          needs > 0
            ? tr("{met} of {total} checks meet the reference, {needs} worth attention", { met, total: rows.length, needs })
            : tr("{met} of {total} checks meet the reference", { met, total: rows.length }),
        against:
          published === 0
            ? tr("this app's curated guidance (the studies are under Learn)")
            : published === ids.length
              ? tr("{authorities} guidance", { authorities: listWords(authorities.map((a) => tr(a))) })
              : tr("{authorities} guidance for {published} of these checks, and this app's curated guidance for the other {rest}", { authorities: listWords(authorities.map((a) => tr(a))), published, rest: ids.length - published }),
        ratio: share,
        read: readOf(share, rows.length),
      });
    }
    if (parts.length === 0) {
      parts.push({
        label: tr("Your places"),
        basis: "guideline",
        measured: tr("no checks answered yet"),
        against: tr("US EPA, WHO and US Surgeon General guidance where they give a number, and this app's curated guidance for the rest"),
        ratio: null,
        read: "not_enough_yet",
      });
    }

    const notes: string[] = [];
    const worth = [...attention].sort((a, b) => stillToGain(b) - stillToGain(a)).slice(0, 3);
    if (worth.length > 0) notes.push(tr("Worth a look first: {items}.", { items: worth.map((x) => `${tr(x.place.label)}: ${tr(x.reading.short)}`).join("; ") }));
    if (scored.length > 0 && attention.length === 0) notes.push(tr("Everything you have checked meets its reference."));
    const amplified = worth.find((x) => x.weight > x.substance.concern_level * timeFactor(x.place) + 1e-9);
    if (amplified) {
      const notesFor = householdNotes(amplified.substance, peopleIn(amplified.place, data.profile));
      const who = notesFor.filter((n) => n.who !== "You").map((n) => `${tr(n.who)} (${tr(n.reasons[0].label).toLowerCase()})`);
      if (who.length > 0)
        notes.push(trn(who.length, "{finding} at {place} counts for a little more because {people} shares it.", "{finding} at {place} counts for a little more because {people} share it.", { finding: capitalize(tr(amplified.reading.short)), place: tr(amplified.place.label), people: listWords(who) }));
    }
    const stale = scored.filter((x) => x.ageDays > FRESH_DAYS).length;
    if (stale > 0) notes.push(trn(stale, "{n} answer is over a year old: a fresh look keeps the comparison current.", "{n} answers are over a year old: a fresh look keeps the comparison current."));
    if (unanswered > 0) notes.push(trn(unanswered, "{n} check not answered yet ({names}). Each one you answer fills in the picture.", "{n} checks not answered yet ({names}). Each one you answer fills in the picture.", { names: `${unansweredNames.join("; ")}${unanswered > unansweredNames.length ? "; ..." : ""}` }));
    if (lean > 0.25) notes.push(tr("With only a few things compared so far, this leans toward a typical place so one answer doesn't swing it; it follows your own answers more as you add them."));
    notes.push(tr("Fixing something, or updating an answer, moves this straight away. Spending more of the week in a place, or sharing it with someone it matters more for, makes its findings count for more."));

    return {
      key: "places",
      value,
      confidence,
      parts,
      summary: scored.length === 0 ? tr("No places checked yet.") : tr("{meets} of {total} checks across your places meet their reference.", { meets, total: scored.length }),
      notes,
    };
  },
};
