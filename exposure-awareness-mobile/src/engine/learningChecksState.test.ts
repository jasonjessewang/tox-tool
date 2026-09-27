/**
 * Recall practice end to end: real storage, real signals, a passing clock. What is asked, what the answer records, what comes
 * back when, and what the Understanding part of the score does (and never does) about it.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as db from "../storage/db";
import { LESSONS, curriculumRef } from "../data/curriculum";
import { checksForLesson } from "../data/conceptChecks";
import { answerConceptCheck, getRecallState } from "./learningChecksState";
import { attemptsFrom, REVIEW_STEPS, statusOf } from "./learningChecks";
import { getWellnessScore } from "./wellnessState";
import { localISODate } from "../util/dates";

const at = (dayOffset: number) => new Date(2026, 8, 1 + dayOffset, 12);
const iso = (dayOffset: number) => localISODate(at(dayOffset));

const [q1, q2] = checksForLesson(LESSONS[0].id);
const [r1] = checksForLesson(LESSONS[1].id);
const understanding = async (now: Date) => (await getWellnessScore(undefined, now)).components.find((c) => c.key === "learning")!;

beforeEach(async () => {
  await AsyncStorage.clear();
});

test("before any lesson is read there is nothing to ask", async () => {
  const s = await getRecallState(at(0));
  expect(s.recall.available).toBe(0);
  expect(s.next).toEqual([]);
  expect(s.answeredToday).toBe(false);
});

test("reading a lesson opens its two questions, and only those", async () => {
  await db.recordLearning(curriculumRef(LESSONS[0].id), iso(0));
  const s = await getRecallState(at(0));
  expect(s.recall).toMatchObject({ available: 2, attempted: 0, recalled: 0, due: 0, unanswered: 2 });
  expect(s.next.map((n) => [n.check.id, n.reason])).toEqual([[q1.id, "new"], [q2.id, "new"]]);
  expect(s.next.some((n) => n.check.id === r1.id)).toBe(false);
});

test("an answer is recorded, comes back with a receipt from the Understanding part, and is due again the next day", async () => {
  await db.recordLearning(curriculumRef(LESSONS[0].id), iso(0));
  const receipt = await answerConceptCheck(q1.id, true, at(0));
  expect(receipt.kind).toBe("learning");
  expect(receipt.lines.map((l) => l.key)).toEqual(["learning"]);

  const today = await getRecallState(at(0));
  expect(today.answeredToday).toBe(true);
  expect(today.recall).toMatchObject({ attempted: 1, recalled: 1, due: 0, unanswered: 1 });
  expect(today.next.map((n) => n.check.id)).toEqual([q2.id]);

  const tomorrow = await getRecallState(at(1));
  expect(tomorrow.answeredToday).toBe(false);
  expect(tomorrow.recall.due).toBe(1);
  // the one that was answered comes first: an idea due for review before one not yet tried
  expect(tomorrow.next.map((n) => [n.check.id, n.reason])).toEqual([[q1.id, "due"], [q2.id, "new"]]);
});

test("a question answered right comes back further apart each time, and one that is missed comes back tomorrow", async () => {
  await db.recordLearning(curriculumRef(LESSONS[0].id), iso(0));
  let day = 0;
  const gaps: number[] = [];
  for (let round = 0; round < REVIEW_STEPS.length; round++) {
    await answerConceptCheck(q1.id, true, at(day));
    const status = statusOf(q1.id, attemptsFrom(await db.getLearningEvents()));
    const gap = Math.round((new Date(`${status.dueOn}T12:00:00`).getTime() - new Date(`${iso(day)}T12:00:00`).getTime()) / 86400000);
    gaps.push(gap);
    day += gap;
  }
  expect(gaps).toEqual([...REVIEW_STEPS]);

  // a slip after all that: back tomorrow, and the streak starts over
  await answerConceptCheck(q1.id, false, at(day));
  const status = statusOf(q1.id, attemptsFrom(await db.getLearningEvents()));
  expect(status.streak).toBe(0);
  expect(status.dueOn).toBe(iso(day + 1));
});

test("the Understanding reading rises with right answers and is untouched by misses", async () => {
  await db.recordLearning(curriculumRef(LESSONS[0].id), iso(0));
  const base = await understanding(at(0));

  await answerConceptCheck(q1.id, false, at(0));
  const missed = await understanding(at(0));
  expect(missed.value).toBe(base.value);
  expect(missed.confidence).toBe(base.confidence);

  await answerConceptCheck(q1.id, true, at(1));
  const right = await understanding(at(1));
  expect(right.value).toBeGreaterThan(base.value);

  // and a later slip never takes it back
  await answerConceptCheck(q1.id, false, at(5));
  expect((await understanding(at(5))).value).toBe(right.value);
});

test("answering counts as a day of learning (the plant and the streaks see it), and stays out of the way of the lesson record", async () => {
  await db.recordLearning(curriculumRef(LESSONS[0].id), iso(0));
  await answerConceptCheck(q1.id, true, at(3));
  expect(await db.getLearningDates(iso(3))).toEqual([iso(3)]);
  expect(await db.getLearningRefs("curriculum:")).toEqual([curriculumRef(LESSONS[0].id)]);
});

test("months of practice keep the lessons and the latest attempts, and only trim the old attempts on the same question", async () => {
  await db.recordLearning(curriculumRef(LESSONS[0].id), iso(0));
  for (let d = 0; d < 40; d++) await answerConceptCheck(q1.id, d % 3 !== 0, at(d));
  const events = await db.getLearningEvents();
  const attempts = attemptsFrom(events).filter((a) => a.questionId === q1.id);
  expect(attempts.length).toBe(12);
  expect(attempts[attempts.length - 1].day).toBe(iso(39));
  expect(events.some((e) => e.ref === curriculumRef(LESSONS[0].id))).toBe(true);
  // what is left is still enough to schedule the next review
  expect(statusOf(q1.id, attempts).dueOn).not.toBeNull();
});

test("answering twice the same day the same way is one attempt; the second, different answer is the one that counts", async () => {
  await db.recordLearning(curriculumRef(LESSONS[0].id), iso(0));
  await answerConceptCheck(q1.id, true, at(0));
  await answerConceptCheck(q1.id, true, at(0));
  expect(attemptsFrom(await db.getLearningEvents()).filter((a) => a.questionId === q1.id)).toHaveLength(1);
  await answerConceptCheck(q1.id, false, at(0));
  const s = statusOf(q1.id, attemptsFrom(await db.getLearningEvents()));
  expect(s.lastCorrect).toBe(false);
  expect(s.dueOn).toBe(iso(1));
});
