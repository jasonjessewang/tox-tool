/** Recalling ideas, answered right on the lessons that have been read, can add up to this many points beyond reading them. */
export const RECALL_BONUS_POINTS = 20;

/**
 * Elective modules add on top, a fixed amount per lesson read and per question recalled, up to a cap. A fixed amount (not a share
 * of all electives) means a module added in a later version never shrinks what someone already earned.
 */
export const ELECTIVE_POINTS_PER_LESSON = 1;
export const ELECTIVE_POINTS_PER_RECALL = 0.5;
export const ELECTIVE_BONUS_CAP = 10;

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
import { MODULE_LESSONS } from "../../data/modules";
import { CONCEPT_CHECKS, MODULE_CHECKS } from "../../data/conceptChecks";
import { computeLiteracy } from "../literacy";
import { attemptsFrom, recallSummary } from "../learningChecks";
import type { ComparisonPart, ComparisonRead, Signal, SignalContext, SignalResult } from "./types";
import { ageOf } from "./decay";
import { msg, tr, trn } from "../../i18n";

export const understandingSignal: Signal = {
  key: "learning",
  label: msg("Understanding"),
  blurb: msg("How far through the toxicology curriculum you are. It counts for more as you complete more of it."),
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
      notes.push(gap === 0 ? tr("You learned something today.") : trn(gap, "You last learned something {n} day ago.", "You last learned something {n} days ago."));
    }
    if (literacy.next) notes.push(tr("Next lesson: {title}.", { title: tr(literacy.next.title) }));

    // Recall: the questions on the lessons that have been read. Each one answered right at least once adds a little; a wrong answer
    // adds nothing and takes nothing away, so practising can only ever raise this part.
    const readIds = new Set(LESSONS.filter((l) => refs.has(curriculumRef(l.id))).map((l) => l.id));
    const attempts = attemptsFrom(events);
    const recall = recallSummary(readIds, attempts, asOf);
    const bonus = (RECALL_BONUS_POINTS * recall.recalled) / CONCEPT_CHECKS.length;

    // Electives: only ever added, and kept out of the core shares above, so reading one cannot lower anything.
    const electiveIds = new Set(MODULE_LESSONS.filter((l) => refs.has(curriculumRef(l.id))).map((l) => l.id));
    const electiveRecall = recallSummary(electiveIds, attempts, asOf, MODULE_CHECKS);
    const electiveBonus = Math.min(ELECTIVE_BONUS_CAP, electiveIds.size * ELECTIVE_POINTS_PER_LESSON + electiveRecall.recalled * ELECTIVE_POINTS_PER_RECALL);
    const recallRatio = recall.available > 0 ? recall.recalled / recall.available : null;
    const recallRead: ComparisonRead = recall.attempted < 3 ? "not_enough_yet" : (recallRatio ?? 0) >= 0.8 ? "on_target" : (recallRatio ?? 0) >= 0.5 ? "close" : "room_to_grow";
    const parts: ComparisonPart[] = [
      {
        label: tr("Curriculum"),
        basis: "curriculum",
        measured: tr("{done} of {total} lessons", { done: literacy.doneCount, total: literacy.totalCount }),
        against: tr("the whole toxicology curriculum"),
        ratio: literacy.pct / 100,
        read,
      },
    ];
    if (recall.available > 0) {
      parts.push({
        label: tr("Recall"),
        basis: "curriculum",
        measured:
          recall.unanswered > 0
            ? tr("{recalled} of {available} questions on the lessons you've read answered right ({unanswered} not tried yet)", { recalled: recall.recalled, available: recall.available, unanswered: recall.unanswered })
            : tr("{recalled} of {available} questions on the lessons you've read answered right", { recalled: recall.recalled, available: recall.available }),
        against: tr("the two questions on each lesson you've read -- one you miss just comes back sooner"),
        ratio: recallRatio,
        read: recallRead,
      });
      if (recall.due > 0) notes.push(trn(recall.due, "{n} idea is due for a quick review.", "{n} ideas are due for a quick review."));
    }
    if (electiveIds.size > 0) {
      const share = electiveIds.size / MODULE_LESSONS.length;
      parts.push({
        label: tr("Electives"),
        basis: "curriculum",
        measured:
          electiveRecall.recalled > 0
            ? tr("{read} of {total} elective lessons read, {recalled} of their questions answered right", { read: electiveIds.size, total: MODULE_LESSONS.length, recalled: electiveRecall.recalled })
            : tr("{read} of {total} elective lessons read", { read: electiveIds.size, total: MODULE_LESSONS.length }),
        against: tr("the elective modules -- cancer & prevention, cosmetics, the exposome. Each adds a little, up to {cap} points, and never counts against the core curriculum", { cap: ELECTIVE_BONUS_CAP }),
        ratio: share,
        read: share >= 0.8 ? "on_target" : share >= 0.4 ? "close" : "not_enough_yet",
      });
    }

    return {
      key: "learning",
      value: Math.min(100, literacy.pct + bonus + electiveBonus),
      confidence: literacy.pct / 100,
      parts,
      summary: literacy.doneCount === 0 ? tr("Curriculum not started.") : tr("{pct}% through the toxicology curriculum.", { pct: literacy.pct }),
      notes,
    };
  },
};
