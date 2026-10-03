/**
 * Reading the places. Every answer is a comparison with a reference (data/placeChecks.ts), so a place reads as: which of
 * its checks meet the reference, which are worth attention, and which are not yet known. From that come three things:
 *
 *   readings       -- the per-check facts, as of any day (answers are dated and kept, so the past can be read too)
 *   standing       -- the exposure a place carries week after week, in the same form the shelf's is, so advice draws on both
 *   household lens -- who shares the place, and for whom a finding matters most
 */
import { checksFor } from "../../data/placeChecks";
import { daysBetweenISO } from "../../util/dates";
import { getPersonalReasons } from "../personalization";
import type { PersonalReason, StandingExposure, Substance, UserProfile } from "../types";
import { PLACE_INFO, type AnswerEntry, type CheckReading, type Occupant, type Place, type PlaceCheck } from "./types";
import { msg } from "../../i18n";

/** The answer in force on a day: the newest one given on or before it. */
export function answerAsOf(place: Place, checkId: string, asOf: string): AnswerEntry | null {
  const list = place.answers[checkId] ?? [];
  for (let i = list.length - 1; i >= 0; i--) if (list[i].day <= asOf) return list[i];
  return null;
}

/** One reading per check that applies to the place; a check nobody has answered (or whose answer no longer exists) is unknown. */
export function readPlace(place: Place, asOf: string): CheckReading[] {
  return checksFor(place.kind).map((check) => {
    const entry = answerAsOf(place, check.id, asOf);
    const option = entry ? check.options.find((o) => o.value === entry.value) ?? null : null;
    return {
      checkId: check.id,
      placeId: place.id,
      placeKind: place.kind,
      placeLabel: place.label,
      short: check.short,
      status: option ? option.status : "unknown",
      standing: option?.status === "attention" ? option.standing ?? 1 : 0,
      substanceId: option?.substanceId ?? check.substanceId,
      answerLabel: option?.label ?? null,
      day: entry?.day ?? null,
    };
  });
}

export const readPlaces = (places: Place[], asOf: string): CheckReading[] => places.flatMap((p) => readPlace(p, asOf));

/** An answer stays fully fresh for a year; after that it carries less evidence (never less than 40%): homes change. */
export const FRESH_DAYS = 365;

export function answerFreshness(ageDays: number): number {
  return ageDays <= FRESH_DAYS ? 1 : Math.max(0.4, 1 - (ageDays - FRESH_DAYS) / 600);
}

/** Days since the answer was given, or null when the check has not been answered. */
export const answerAge = (r: CheckReading, asOf: string) => (r.day ? Math.max(0, daysBetweenISO(r.day, asOf)) : null);

export const isAnswered = (r: CheckReading) => r.status !== "unknown";

export function countReadings(readings: CheckReading[]) {
  const answered = readings.filter(isAnswered);
  return {
    total: readings.length,
    answered: answered.length,
    meets: readings.filter((r) => r.status === "meets").length,
    attention: readings.filter((r) => r.status === "attention").length,
    na: readings.filter((r) => r.status === "na").length,
  };
}

// ------------------------------------------------------------------------------ time and people

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export const placeHours = (place: Place) => place.hoursPerWeek ?? PLACE_INFO[place.kind].defaultHours;
/** How much a place's findings weigh, by how much of the week is spent there (40 hours is 1). */
export const timeFactor = (place: Place) => clamp(placeHours(place) / 40, 0.25, 2);

const PET_NOTES: Record<string, string> = {
  household_dust_reservoir: msg("Pets live at floor level and lick what they walk on, so floor dust reaches them directly."),
  lawn_pesticide_tracked_in: msg("Pets walk on treated grass and clean their paws with their mouths."),
};

/** An occupant seen through the same lens the app applies to the user's own profile. */
export function occupantProfile(o: Occupant): UserProfile {
  return {
    ageYears: o.ageYears,
    sex: "unspecified",
    weightKg: null,
    heightCm: null,
    pregnant: o.pregnant,
    breastfeeding: false,
    conditions: o.conditions,
    contentComplexity: "balanced",
    completedAt: "",
    locationEnabled: false,
    checkInTime: "off",
  };
}

export const selfOccupant = (profile: UserProfile): Occupant => ({
  id: "self",
  label: msg("You"),
  ageYears: profile.ageYears,
  pregnant: profile.pregnant,
  conditions: profile.conditions,
  isPet: false,
});

export interface HouseholdNote {
  who: string;
  reasons: PersonalReason[];
}

/** For whom a substance matters most among the people who share a place, and why -- reusing the personalization rules. */
export function householdNotes(substance: Substance, people: Occupant[]): HouseholdNote[] {
  const out: HouseholdNote[] = [];
  for (const o of people) {
    if (o.isPet) {
      const reason = PET_NOTES[substance.id];
      if (reason) out.push({ who: o.label, reasons: [{ conceptTag: "pets", label: msg("Pet"), reason }] });
      continue;
    }
    const reasons = getPersonalReasons(substance, occupantProfile(o));
    if (reasons.length > 0) out.push({ who: o.label, reasons });
  }
  return out;
}

/** A finding counts for a little more when it matters especially to someone who shares the place (at most +75%). */
export const amplification = (substance: Substance, people: Occupant[]) => 1 + Math.min(0.75, 0.25 * householdNotes(substance, people).length);

/** Everyone in a place, including the user, for the purposes of who it matters most for. */
export const peopleIn = (place: Place, profile: UserProfile | null): Occupant[] => [...(profile ? [selfOccupant(profile)] : []), ...place.occupants];

// ------------------------------------------------------------------------------ weighing what was found

export interface WeighedReading {
  reading: CheckReading;
  place: Place;
  substance: Substance;
  /** how much it counts: the concern's level, the hours spent in the place, and who shares it */
  weight: number;
  /** meets is full credit; a concern only partly still in place gets the rest */
  credit: number;
  ageDays: number;
}

/**
 * Every answered comparison across the places, weighed -- and the checks not yet answered. Shared by the score's Places part,
 * the overview and the dashboard card, so they can never disagree about what counts for how much.
 */
export function weighPlaces(places: Place[], substances: Substance[], asOf: string, profile: UserProfile | null): { scored: WeighedReading[]; unanswered: { place: Place; reading: CheckReading }[] } {
  const byId = new Map(substances.map((s) => [s.id, s]));
  const scored: WeighedReading[] = [];
  const unanswered: { place: Place; reading: CheckReading }[] = [];
  for (const place of places) {
    const people = peopleIn(place, profile);
    const time = timeFactor(place);
    for (const reading of readPlace(place, asOf)) {
      if (reading.status === "unknown") {
        unanswered.push({ place, reading });
        continue;
      }
      if (reading.status === "na") continue;
      const substance = byId.get(reading.substanceId);
      if (!substance) continue;
      scored.push({
        reading,
        place,
        substance,
        weight: substance.concern_level * amplification(substance, people) * time,
        credit: reading.status === "meets" ? 1 : 1 - reading.standing,
        ageDays: answerAge(reading, asOf) ?? 0,
      });
    }
  }
  return { scored, unanswered };
}

/** How much a worth-attention finding still has to give: its weight times what is left in place. Orders "look at this first". */
export const stillToGain = (w: WeighedReading) => w.weight * (1 - w.credit);

export interface PlacesSummary {
  places: number;
  /** checks compared with a reference (answered, and applicable) */
  compared: number;
  meets: number;
  attention: number;
  /** checks that apply and are not yet answered */
  unanswered: number;
  /** what is worth a look first, most consequential first */
  worth: { placeLabel: string; short: string }[];
}

export function summarizePlaces(places: Place[], substances: Substance[], asOf: string, profile: UserProfile | null): PlacesSummary {
  const { scored, unanswered } = weighPlaces(places, substances, asOf, profile);
  const attention = scored.filter((w) => w.reading.status === "attention");
  return {
    places: places.length,
    compared: scored.length,
    meets: scored.length - attention.length,
    attention: attention.length,
    unanswered: unanswered.length,
    worth: [...attention].sort((a, b) => stillToGain(b) - stillToGain(a)).map((w) => ({ placeLabel: w.place.label, short: w.reading.short })),
  };
}

// ------------------------------------------------------------------------------ standing exposure

/** Comparable in scale to a daily-use product's servings a week, so places and shelf rank against each other in Focus. */
const BASE_WEIGHT = 3;
const MAX_WEIGHT = 12;

/**
 * The exposure the places carry week after week: every check that is worth attention becomes a standing substance, weighted by how much
 * of the concern the answer leaves in place, how much of the week is spent there, and who shares the space.
 */
export function placesStanding(places: Place[], substances: Substance[], asOf: string, profile: UserProfile | null): StandingExposure[] {
  const byId = new Map(substances.map((s) => [s.id, s]));
  const acc = new Map<string, { weight: number; via: string[] }>();
  for (const place of places) {
    const time = timeFactor(place);
    const people = peopleIn(place, profile);
    for (const r of readPlace(place, asOf)) {
      if (r.status !== "attention") continue;
      const substance = byId.get(r.substanceId);
      if (!substance) continue;
      const cur = acc.get(substance.id) ?? { weight: 0, via: [] };
      cur.weight += BASE_WEIGHT * r.standing * time * amplification(substance, people);
      cur.via.push(`${r.placeLabel}: ${r.short}`);
      acc.set(substance.id, cur);
    }
  }
  return [...acc].map(([substanceId, v]) => ({ substanceId, weight: Math.round(Math.min(MAX_WEIGHT, v.weight) * 100) / 100, via: [], viaPlaces: v.via, origin: "places" as const }));
}

// ------------------------------------------------------------------------------ what to ask next

/** A check the person answered "not sure" (or took back) is left alone for a month before it is asked again. */
export const ASK_AGAIN_DAYS = 30;

/** substance id -> the day the person last marked a tip about it done */
export type CompletedOn = Record<string, string>;

export interface NextCheck {
  place: Place;
  check: PlaceCheck;
  /** why it is being asked: a tip about it was marked done since the last answer, it was never answered (or "not sure"), or it was answered over a year ago */
  reason: "recheck" | "unanswered" | "stale";
  weight: number;
}

/** A finding worth attention whose tip the person has since marked done: has the answer changed? */
export const needsRecheck = (r: CheckReading, completedOn: CompletedOn) => r.status === "attention" && r.day !== null && (completedOn[r.substanceId] ?? "") > r.day;

const REASON_ORDER: Record<NextCheck["reason"], number> = { recheck: 0, unanswered: 1, stale: 2 };

/**
 * The checks worth asking next, in order: a finding the person has acted on since they answered (has it changed? -- closing the loop
 * from advice back to the picture), then things not yet known, then answers over a year old, each ranked by how much it would
 * count (the concern, the hours spent there, who shares it).
 */
export function nextChecks(places: Place[], substances: Substance[], asOf: string, profile: UserProfile | null, limit = 3, completedOn: CompletedOn = {}): NextCheck[] {
  const byId = new Map(substances.map((s) => [s.id, s]));
  const out: NextCheck[] = [];
  for (const place of places) {
    const people = peopleIn(place, profile);
    const time = timeFactor(place);
    for (const r of readPlace(place, asOf)) {
      const age = answerAge(r, asOf);
      const recheck = needsRecheck(r, completedOn);
      const stale = r.status !== "unknown" && age !== null && age > FRESH_DAYS;
      if (r.status !== "unknown" && !stale && !recheck) continue;
      if (r.status === "unknown" && age !== null && age <= ASK_AGAIN_DAYS) continue; // asked, and the answer was "not sure": don't nag
      const check = checksFor(place.kind).find((c) => c.id === r.checkId)!;
      const substance = byId.get(r.status === "attention" ? r.substanceId : check.substanceId);
      if (!substance) continue;
      out.push({ place, check, reason: recheck ? "recheck" : stale ? "stale" : "unanswered", weight: substance.concern_level * amplification(substance, people) * time });
    }
  }
  return out.sort((a, b) => (a.reason === b.reason ? b.weight - a.weight : REASON_ORDER[a.reason] - REASON_ORDER[b.reason])).slice(0, limit);
}
