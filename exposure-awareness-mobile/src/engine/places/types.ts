/**
 * Places: the spaces where a person's days actually happen. Home (and the people in it), work, and the everyday places
 * they pass through. Each place has a short checklist compared with published guidance; the answers are standing
 * facts about the environment -- like the shelf, they persist whether or not anything was logged this week -- so they
 * feed advice and the score's comparisons rather than the weekly log.
 */
import type { Condition } from "../types";
import { msg } from "../../i18n";

export type PlaceKind = "home" | "work" | "daily";

export const PLACE_KINDS: PlaceKind[] = ["home", "work", "daily"];

export const PLACE_INFO: Record<PlaceKind, { label: string; icon: string; blurb: string; defaultHours: number; hourPresets: { label: string; hours: number }[] }> = {
  home: {
    label: msg("Home"), icon: "🏠", defaultHours: 100,
    blurb: msg("Where you sleep, cook and spend most of your hours -- and who shares it with you."),
    hourPresets: [{ label: msg("Away a lot"), hours: 60 }, { label: msg("About average"), hours: 100 }, { label: msg("Home most days"), hours: 130 }],
  },
  work: {
    label: msg("Work or school"), icon: "🏢", defaultHours: 40,
    blurb: msg("The place you spend a working week: the air, the building and what's been done to it."),
    hourPresets: [{ label: msg("Part-time"), hours: 20 }, { label: msg("Full-time"), hours: 40 }, { label: msg("Long weeks"), hours: 55 }],
  },
  daily: {
    label: msg("Everyday places"), icon: "🚌", defaultHours: 8,
    blurb: msg("What you pass through every day: the commute, the air outside, what you carry and drink from."),
    hourPresets: [{ label: msg("A few hours"), hours: 4 }, { label: msg("About 8"), hours: 8 }, { label: msg("Most of a day"), hours: 15 }],
  },
};

/** Someone who shares a place with you (or a pet): used to see who a finding matters most for. */
export interface Occupant {
  id: string;
  label: string;
  ageYears: number | null;
  pregnant: boolean;
  conditions: Condition[];
  isPet: boolean;
}

/** One answer to one check, dated: earlier answers are kept so the picture can be compared with an earlier day. */
export interface AnswerEntry {
  value: string;
  /** the local day it was given */
  day: string;
}

export interface Place {
  id: string;
  kind: PlaceKind;
  label: string;
  /** hours a week spent here, for weighting how much a finding matters; null = the default for the kind */
  hoursPerWeek: number | null;
  occupants: Occupant[];
  /** check id -> answers, oldest first */
  answers: Record<string, AnswerEntry[]>;
  updatedAt: string;
}

/**
 * How an answer stands against the reference the check compares with. "na" is an answer that takes the check off the
 * table (no gas stove, no central air): it is neither credit nor concern, and does not count against the picture.
 */
export type AnswerStatus = "meets" | "attention" | "unknown" | "na";

export interface AnswerOption {
  value: string;
  label: string;
  status: AnswerStatus;
  /**
   * For "attention": how much of the concern this answer leaves in place, 0..1. A stove with no hood is 1; one where a hood
   * is sometimes used is 0.5. Drives both the partial credit in the score and the weight of the advice it produces.
   */
  standing?: number;
  /** When a check can point at more than one substance (humidity too high or too low), the one this answer is about. */
  substanceId?: string;
}

export interface PlaceCheck {
  id: string;
  places: PlaceKind[];
  /** the short name shown in "why this is on your list" lines */
  short: string;
  question: string;
  /** how to find out, when the person might not know */
  help?: string;
  options: AnswerOption[];
  /** the engine substance this check is about (the tips and evidence come from it) */
  substanceId: string;
  /** what the answer is compared with, and where that comes from */
  reference: { text: string; source: string };
  /** a plain, calm line on why it is worth knowing */
  why: string;
}

export interface CheckReading {
  checkId: string;
  placeId: string;
  placeKind: PlaceKind;
  placeLabel: string;
  short: string;
  status: AnswerStatus;
  /** for attention: how much of the concern remains (0..1) */
  standing: number;
  substanceId: string;
  answerLabel: string | null;
  /** the day this was answered */
  day: string | null;
}
