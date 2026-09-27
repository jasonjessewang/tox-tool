/**
 * Keeping the places: creating them, answering their checks (answers are dated and kept, never overwritten, so the
 * picture can be compared with an earlier day), and the household that shares them. Every change goes through the storage lock.
 */
import * as db from "../../storage/db";
import { loadHazardDb } from "../scoring";
import type { UserProfile } from "../types";
import { checkById } from "../../data/placeChecks";
import { daysAgoISO, localISODate } from "../../util/dates";
import { PLACE_INFO, type Occupant, type Place, type PlaceKind } from "./types";
import { nextChecks, placesStanding, summarizePlaces, type CompletedOn, type NextCheck, type PlacesSummary } from "./evaluate";

/** Answers kept per check: enough to compare with an earlier self, not an ever-growing list. */
const MAX_ANSWERS = 12;

export const newPlaceId = () => `place-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function newPlace(kind: PlaceKind, label?: string): Place {
  return { id: newPlaceId(), kind, label: label?.trim() || PLACE_INFO[kind].label, hoursPerWeek: null, occupants: [], answers: {}, updatedAt: new Date().toISOString() };
}

export const newOccupant = (partial: Partial<Occupant> & { label: string }): Occupant => ({
  id: `person-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  ageYears: null,
  pregnant: false,
  conditions: [],
  isPet: false,
  ...partial,
});

const touch = (p: Place): Place => ({ ...p, updatedAt: new Date().toISOString() });

async function change(id: string, fn: (p: Place) => Place): Promise<Place> {
  return db.updatePlace(id, (current) => {
    if (!current) throw new Error(`No place ${id}`);
    return touch(fn(current));
  });
}

export async function addPlace(kind: PlaceKind, label?: string): Promise<Place> {
  const place = newPlace(kind, label);
  await db.savePlace(place);
  return place;
}

export const removePlace = (id: string) => db.deletePlace(id);
export const renamePlace = (id: string, label: string) => change(id, (p) => ({ ...p, label: label.trim() || p.label }));
export const setPlaceHours = (id: string, hours: number | null) => change(id, (p) => ({ ...p, hoursPerWeek: hours === null ? null : Math.max(0, Math.min(168, Math.round(hours))) }));

/**
 * Records an answer as of a day. The same day replaces (a correction); a later day adds to the history, even when the answer is
 * the same, because a re-confirmed answer is a fresher one.
 */
export async function answerCheck(placeId: string, checkId: string, value: string, now: Date = new Date()): Promise<Place> {
  const check = checkById(checkId);
  if (!check) throw new Error(`No check ${checkId}`);
  if (value !== "" && !check.options.some((o) => o.value === value)) throw new Error(`No answer ${value} for ${checkId}`);
  const day = localISODate(now);
  return change(placeId, (p) => {
    if (!check.places.includes(p.kind)) throw new Error(`${checkId} does not apply to a ${p.kind} place`);
    const history = p.answers[checkId] ?? [];
    const last = history[history.length - 1];
    const next = last && last.day === day ? [...history.slice(0, -1), { value, day }] : [...history, { value, day }];
    return { ...p, answers: { ...p.answers, [checkId]: next.slice(-MAX_ANSWERS) } };
  });
}

/** Takes an answer back to unknown (recorded as a dated blank, so the earlier answer still stands for earlier days). */
export const clearAnswer = (placeId: string, checkId: string, now: Date = new Date()) => answerCheck(placeId, checkId, "", now);

export const saveOccupant = (placeId: string, occupant: Occupant) =>
  change(placeId, (p) => ({ ...p, occupants: p.occupants.some((o) => o.id === occupant.id) ? p.occupants.map((o) => (o.id === occupant.id ? occupant : o)) : [...p.occupants, occupant] }));

export const removeOccupant = (placeId: string, occupantId: string) => change(placeId, (p) => ({ ...p, occupants: p.occupants.filter((o) => o.id !== occupantId) }));

/** What the places carry week after week, ready to hand to the advice engine alongside the shelf's. */
export async function getPlacesStanding(now: Date = new Date(), profile?: UserProfile | null): Promise<ReturnType<typeof placesStanding>> {
  const [places, prof] = await Promise.all([db.getPlaces(), profile === undefined ? db.getUserProfile() : Promise.resolve(profile)]);
  return placesStanding(places, loadHazardDb(), localISODate(now), prof);
}

export interface PlacesOverview {
  places: Place[];
  profile: UserProfile | null;
  summary: PlacesSummary;
  /** the one question worth asking next, or null when nothing is left to ask */
  next: NextCheck | null;
  /** tips the person has marked done in the last month, by substance: the answers that may since have changed */
  completedOn: CompletedOn;
}

/** How far back "I did something about this" still prompts a second look at the answer. */
export const RECHECK_DAYS = 30;

/** Everything the Places screen and the dashboard card need, read once. */
export async function getPlacesOverview(now: Date = new Date()): Promise<PlacesOverview> {
  const [places, profile, completed] = await Promise.all([db.getPlaces(), db.getUserProfile(), db.getCompletedActions(daysAgoISO(RECHECK_DAYS, now))]);
  const substances = loadHazardDb();
  const asOf = localISODate(now);
  const completedOn: CompletedOn = {};
  for (const c of completed) {
    const id = c.tip_key.split(":")[0];
    if ((completedOn[id] ?? "") < c.completed_date) completedOn[id] = c.completed_date;
  }
  return { places, profile, summary: summarizePlaces(places, substances, asOf, profile), next: nextChecks(places, substances, asOf, profile, 1, completedOn)[0] ?? null, completedOn };
}
