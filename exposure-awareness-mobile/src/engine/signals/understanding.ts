/** Recalling ideas, answered right on the lessons that have been read, can add up to this many points beyond reading them. */
export const RECALL_BONUS_POINTS = 20;

/**
 * Understanding. Progress through the toxicology curriculum, compared with the whole of it, and how much of what was read has stuck. The end state the app aims
 * for is independence: being able to sanity-check a health claim without it. A person who has not begun has no evidence
 * here yet (not a zero), so it stays out of the picture until they do.
 *
 * The evidence behind this reading is the share of the curriculum completed: the more lessons behind it, the more it
 * counts. That keeps the first lesson from tugging the whole score in either direction -- a beginner's reading is
 * simply light -- and lets it carry its full weight only once most of the curriculum has been worked through.
 */
import { LESSONS, curriculumRef } from "../../data/curriculum";
import { CONCEPT_CHECKS } from "../../data/conceptChecks";
import { computeLiteracy } from "../literacy";
import { attemptsFrom, recallSummary } from "../learningChecks";
import type { ComparisonPart, ComparisonRead, Signal, SignalContext, SignalResult } from "./types";
import { ageOf } from "./decay";

export const understandingSignal: Signal = {
  key: "learning",
  label: "Understanding",
  blurb: "How far through the toxicology curriculum you are. It counts for more as you complete more of it.",
  defaultWeight: 10,
  sources: ["learning"],
  evaluate({ asOf, data }: SignalContext): SignalResult {
    const events = data.learning.filter((e) => e.date <= asOf);
    const refs = new Set(events.map((e) => e.ref));
    const literacy = computeLiteracy(new Set(LESSONS.filter((l) => refs.has(curriculumRef(l.id))).map((l) => l.id)));
    const lastLearned = events.reduce<string | null>((a, e) => (a === null || e.date > a ? e.date : a), null);

    const read: ComparisonRead = literacy.doneCount === 0 ? "not_enough_yet" : literacy.pct >= 80 ? "on_target" : literacy.pct >= 40 ? "close" : "room_to_grow";
    const notes: string[] = [];
    if (lastLearned) {
      const gap = Math.max(0, ageOf(lastLearned, asOf));
      notes.push(gap === 0 ? "You learned something today." : `You last learned something ${gap} day${gap === 1 ? "" : "s"} ago.`);
    }
    if (literacy.next) notes.push(`Next lesson: ${literacy.next.title}.`);

    // Recall: the questions on the lessons that have been read. Each one answered right at least once adds a little; a wrong answer
    // adds nothing and takes nothing away, so practising can only ever raise this part.
    const readIds = new Set(LESSONS.filter((l) => refs.has(curriculumRef(l.id))).map((l) => l.id));
    const recall = recallSummary(readIds, attemptsFrom(events), asOf);
    const bonus = (RECALL_BONUS_POINTS * recall.recalled) / CONCEPT_CHECKS.length;
    const recallRatio = recall.available > 0 ? recall.recalled / recall.available : null;
    const recallRead: ComparisonRead = recall.attempted < 3 ? "not_enough_yet" : (recallRatio ?? 0) >= 0.8 ? "on_target" : (recallRatio ?? 0) >= 0.5 ? "close" : "room_to_grow";
    const parts: ComparisonPart[] = [
      {
        label: "Curriculum",
        basis: "curriculum",
        measured: `${literacy.doneCount} of ${literacy.totalCount} lessons`,
        against: "the whole toxicology curriculum",
        ratio: literacy.pct / 100,
        read,
      },
    ];
    if (recall.available > 0) {
      parts.push({
        label: "Recall",
        basis: "curriculum",
        measured: `${recall.recalled} of ${recall.available} questions on the lessons you've read answered right${recall.unanswered > 0 ? ` (${recall.unanswered} not tried yet)` : ""}`,
        against: "the two questions on each lesson you've read -- one you miss just comes back sooner",
        ratio: recallRatio,
        read: recallRead,
      });
      if (recall.due > 0) notes.push(`${recall.due} idea${recall.due === 1 ? " is" : "s are"} due for a quick review.`);
    }

    return {
      key: "learning",
      value: Math.min(100, literacy.pct + bonus),
      confidence: literacy.pct / 100,
      parts,
      summary: literacy.doneCount === 0 ? "Curriculum not started." : `${literacy.pct}% through the toxicology curriculum.`,
      notes,
    };
  },
};
