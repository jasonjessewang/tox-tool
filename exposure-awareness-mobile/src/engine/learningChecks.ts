/**
 * Recall practice for the toxicology curriculum: what was answered, what is due to come back, and how much has stuck.
 *
 * Reading a lesson and pressing "Got it" is self-reported. A question about it a few days later is a different thing -- recalling
 * an idea, not recognizing it -- and the research on learning is consistent that retrieval, spaced out, is what makes an idea last.
 * So after a lesson a couple of questions are offered, and each one returns on a widening schedule (1, 3, 7, 14, 30, 60, then
 * every 90 days) for as long as the person keeps answering it right -- which is also what keeps the curriculum alive after the last
 * lesson has been read.
 *
 * Nothing here punishes: a wrong answer shows the explanation and brings the question back the next day, and no score ever falls
 * because of one. Answers are stored as ordinary learning events (`check:<question id>:<1|0>`), so there is no new table.
 */
import { CONCEPT_CHECKS, checksForLesson, type ConceptCheck } from "../data/conceptChecks";
import { daysAgoISO } from "../util/dates";

/** Days until a question returns, by how many times in a row it has been answered right. */
export const REVIEW_STEPS = [1, 3, 7, 14, 30, 60, 90] as const;

export const checkRef = (questionId: string, correct: boolean) => `check:${questionId}:${correct ? 1 : 0}`;

export function parseCheckRef(ref: string): { questionId: string; correct: boolean } | null {
  const m = ref.match(/^check:(.+):([01])$/);
  return m ? { questionId: m[1], correct: m[2] === "1" } : null;
}

export interface CheckAttempt {
  questionId: string;
  day: string;
  correct: boolean;
}

/**
 * Every recorded answer, oldest first. `events` are as storage keeps them -- newest first -- so two answers on the same day are
 * ordered by when they were recorded (the later one is the one that counts).
 */
export function attemptsFrom(events: { ref: string; date: string }[]): CheckAttempt[] {
  const out: (CheckAttempt & { order: number })[] = [];
  events.forEach((e, index) => {
    const p = parseCheckRef(e.ref);
    if (p) out.push({ questionId: p.questionId, day: e.date, correct: p.correct, order: events.length - 1 - index });
  });
  return out.sort((a, b) => (a.day === b.day ? a.order - b.order : a.day < b.day ? -1 : 1)).map(({ order: _o, ...a }) => a);
}

export interface QuestionStatus {
  questionId: string;
  attempts: number;
  /** answered right at least once, ever */
  everCorrect: boolean;
  /** consecutive right answers as of the latest attempt */
  streak: number;
  lastDay: string | null;
  lastCorrect: boolean | null;
  /** the day it comes back: null if never answered */
  dueOn: string | null;
}

const addDays = (day: string, n: number) => daysAgoISO(-n, new Date(`${day}T12:00:00`));

export function statusOf(questionId: string, attempts: CheckAttempt[]): QuestionStatus {
  const mine = attempts.filter((a) => a.questionId === questionId);
  if (mine.length === 0) return { questionId, attempts: 0, everCorrect: false, streak: 0, lastDay: null, lastCorrect: null, dueOn: null };
  let streak = 0;
  for (let i = mine.length - 1; i >= 0 && mine[i].correct; i--) streak += 1;
  const last = mine[mine.length - 1];
  return {
    questionId,
    attempts: mine.length,
    everCorrect: mine.some((a) => a.correct),
    streak,
    lastDay: last.day,
    lastCorrect: last.correct,
    dueOn: addDays(last.day, last.correct ? REVIEW_STEPS[Math.min(streak, REVIEW_STEPS.length) - 1] : 1),
  };
}

export interface Recall {
  /** questions belonging to the lessons that have been read */
  available: number;
  /** of those, answered at least once */
  attempted: number;
  /** of those, answered right at least once (a later slip does not take it back) */
  recalled: number;
  /** answered before, and due to come back on or before the day */
  due: number;
  /** never answered */
  unanswered: number;
}

/** How much of what has been read has been checked, and how much stuck -- as of a day, from the recorded answers. */
export function recallSummary(readLessonIds: Set<string>, attempts: CheckAttempt[], asOf: string): Recall {
  const upTo = attempts.filter((a) => a.day <= asOf);
  const mine = CONCEPT_CHECKS.filter((c) => readLessonIds.has(c.lessonId));
  let attempted = 0;
  let recalled = 0;
  let due = 0;
  for (const c of mine) {
    const s = statusOf(c.id, upTo);
    if (s.attempts > 0) attempted += 1;
    if (s.everCorrect) recalled += 1;
    if (s.dueOn !== null && s.dueOn <= asOf) due += 1;
  }
  return { available: mine.length, attempted, recalled, due, unanswered: mine.length - attempted };
}

/**
 * What to ask next, most useful first: questions that are due (the longest overdue first), then questions on lessons that have been
 * read but never checked. Nothing about a lesson that has not been read: the check for it opens with the lesson itself.
 */
export function nextChecks(readLessonIds: Set<string>, attempts: CheckAttempt[], asOf: string, limit = 3): { check: ConceptCheck; reason: "due" | "new" }[] {
  const upTo = attempts.filter((a) => a.day <= asOf);
  const due: { check: ConceptCheck; overdue: number; streak: number }[] = [];
  const fresh: ConceptCheck[] = [];
  for (const c of CONCEPT_CHECKS) {
    if (!readLessonIds.has(c.lessonId)) continue;
    const s = statusOf(c.id, upTo);
    if (s.attempts === 0) fresh.push(c);
    else if (s.dueOn !== null && s.dueOn <= asOf) due.push({ check: c, overdue: daysBetween(s.dueOn, asOf), streak: s.streak });
  }
  due.sort((a, b) => b.overdue - a.overdue || a.streak - b.streak);
  return [...due.map((d) => ({ check: d.check, reason: "due" as const })), ...fresh.map((c) => ({ check: c, reason: "new" as const }))].slice(0, limit);
}

const daysBetween = (from: string, to: string) => Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000);

/** What to say once the questions on a lesson are done: what stuck, and when the rest comes back. Never a grade. */
export function wrapUp(right: number, total: number): string {
  if (right === total) return `${total === 1 ? "You got it" : "You got them all"}. ${total === 1 ? "It comes" : "They come"} back in a day, then a few days later, then further apart -- that spacing is what makes an idea last.`;
  if (right === 0) return `${total === 1 ? "That one is a new idea" : "These are new ideas"}, and that is what the questions are for. ${total === 1 ? "It comes" : "They come"} back tomorrow, explained again.`;
  return `${right} of ${total} the first time. The rest come back tomorrow, explained again.`;
}

/** Lessons that have questions, for the lesson screen. */
export const questionsFor = checksForLesson;
