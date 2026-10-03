/**
 * What to do when everything is in order.
 *
 * A person whose list of changes is empty -- because nothing is flagged, or because they decided to keep what was -- has reached the
 * point most apps go quiet or invent something to nag about. The picture is never finished, though: readings age, questions on the
 * lessons come due, places have questions still unanswered. This names those, quietly, at most three, each one a place to go.
 * It never invents a problem: with nothing to say it says nothing.
 */
import type { JourneyTarget } from "./journeyStages";
import { tr, trn } from "../i18n";

export interface FreshLine {
  key: "recall" | "biomarker" | "places";
  text: string;
  target: JourneyTarget;
  /** which part of the Learn screen to open, when the target is Learn */
  segment?: "engine";
}

export const BIOMARKER_CADENCE_DAYS = 90;

export function keepFresh(input: { recallDue: number; recallUnanswered: number; daysSinceBiomarker: number | null; placesUnanswered: number }): FreshLine[] {
  const out: FreshLine[] = [];
  const ready = input.recallDue + input.recallUnanswered;
  if (ready > 0) {
    // What is offered is a session of at most three, never the size of the pile: a count of everything waiting only makes it feel like a debt.
    const text = ready === 1 ? tr("A question on a lesson you've read is ready for a quick review.") : ready === 2 ? tr("Two questions on lessons you've read are ready for a quick review.") : tr("A quick review of three questions on lessons you've read is ready.");
    out.push({ key: "recall", text, target: "learn", segment: "engine" });
  }
  if (input.daysSinceBiomarker !== null && input.daysSinceBiomarker > BIOMARKER_CADENCE_DAYS) {
    out.push({ key: "biomarker", text: tr("Your last biomarker reading is {days} days old; a check-in about every three months keeps that part of your picture current.", { days: input.daysSinceBiomarker }), target: "log_biomarker" });
  }
  if (input.placesUnanswered > 0) {
    out.push({ key: "places", text: trn(input.placesUnanswered, "{n} more question about your places would fill in the picture.", "{n} more questions about your places would fill in the picture."), target: "places" });
  }
  return out;
}
