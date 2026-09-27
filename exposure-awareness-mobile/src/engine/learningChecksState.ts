import * as db from "../storage/db";
import { LESSONS, curriculumRef } from "../data/curriculum";
import { attemptsFrom, checkRef, nextChecks, recallSummary, type CheckAttempt, type Recall } from "./learningChecks";
import { runActivity, type Receipt } from "./receipts";
import { localISODate } from "../util/dates";

export interface RecallState {
  /** lessons the person has read ("Got it") */
  readLessons: Set<string>;
  attempts: CheckAttempt[];
  recall: Recall;
  /** the questions worth asking next: due ones first, then unanswered ones on lessons already read */
  next: ReturnType<typeof nextChecks>;
  /** has the person already answered something today (so today's recall is done) */
  answeredToday: boolean;
}

export async function getRecallState(now: Date = new Date(), limit = 3): Promise<RecallState> {
  const events = await db.getLearningEvents();
  const refs = new Set(events.map((e) => e.ref));
  const readLessons = new Set(LESSONS.filter((l) => refs.has(curriculumRef(l.id))).map((l) => l.id));
  const attempts = attemptsFrom(events);
  const today = localISODate(now);
  return {
    readLessons,
    attempts,
    recall: recallSummary(readLessons, attempts, today),
    next: nextChecks(readLessons, attempts, today, limit),
    answeredToday: attempts.some((a) => a.day === today),
  };
}

/** Records one answer through the same receipt every activity returns, so the Understanding part shows what it did. */
export async function answerConceptCheck(questionId: string, correct: boolean, now: Date = new Date()): Promise<Receipt> {
  const { receipt } = await runActivity("learning", () => db.recordLearning(checkRef(questionId, correct), localISODate(now)), { now });
  return receipt;
}
