/**
 * The signals: each one measures something a person did, compares it with a reference, and says how sure it is.
 */
import { exposureSignal } from "./exposure";
import { shelfSignal } from "./shelf";
import { habitsSignal, habitTargets, moodNote } from "./habits";
import { validationSignal, freshnessValue, changeNote, evidenceFrom } from "./validation";
import { understandingSignal, RECALL_BONUS_POINTS } from "./understanding";
import { LESSONS } from "../../data/curriculum";
import { CONCEPT_CHECKS, checksForLesson } from "../../data/conceptChecks";
import { decay, effectiveDays, observedDays, perWeek, HORIZON_DAYS } from "./decay";
import { makeData, daysEnding, type Fixture } from "./fixtures";
import type { Signal, SignalResult } from "./types";

const TODAY = "2026-09-25";
const run = (signal: Signal, f: Fixture, asOf = TODAY): SignalResult => signal.evaluate({ asOf, data: makeData(f) });
const days = (n: number, end = TODAY) => daysEnding(end, n);

/** `n` meals a day for `count` days ending today; every `flaggedEvery`-th meal names something flagged (added sugar, concern 1). */
function meals(count: number, perDay = 2, flaggedEvery = 0, end = TODAY) {
  const out: NonNullable<Fixture["meals"]> = [];
  let i = 0;
  for (const day of days(count, end)) {
    for (let k = 0; k < perDay; k++, i++) out.push({ day, text: flaggedEvery > 0 && i % flaggedEvery === 0 ? "cereal with added sugar" : "rice and beans" });
  }
  return out;
}

describe("decay", () => {
  test("a day's weight halves every ten days and is gone after six weeks", () => {
    expect(decay(0)).toBe(1);
    expect(decay(10)).toBeCloseTo(0.5, 6);
    expect(decay(20)).toBeCloseTo(0.25, 6);
    expect(decay(HORIZON_DAYS + 1)).toBe(0);
    expect(decay(-1)).toBe(0);
  });

  test("a new person is judged against the days they have actually been around, at least a week's worth", () => {
    expect(observedDays(null, TODAY)).toBe(0);
    expect(observedDays("2026-09-25", TODAY)).toBe(1);
    expect(observedDays("2026-09-30", TODAY)).toBe(0); // not started yet as of that day
    expect(effectiveDays(1)).toBe(1);
    // three good days early on read as "on pace", not as three weeks of them
    expect(perWeek(3 * 1, 3)).toBeCloseTo((3 / effectiveDays(7)) * 7, 6);
    expect(perWeek(3, 3)).toBeLessThan(7);
  });
});

describe("exposure: of what you log, how much is flagged", () => {
  test("nothing logged: no evidence, not a fake number", () => {
    const r = run(exposureSignal, {});
    expect(r.confidence).toBe(0);
    expect(r.parts[0].read).toBe("not_enough_yet");
    expect(r.summary).toMatch(/too few entries/i);
  });

  test("clean logging reads high, and confidence grows with how much is logged", () => {
    const few = run(exposureSignal, { meals: meals(1, 2) });
    const many = run(exposureSignal, { meals: meals(14, 3) });
    expect(many.value).toBeGreaterThanOrEqual(95);
    expect(many.confidence).toBeGreaterThan(few.confidence);
    expect(many.confidence).toBeGreaterThan(0.9);
  });

  test("the flagged share lowers the reading in proportion", () => {
    const light = run(exposureSignal, { meals: meals(14, 3, 10) });
    const heavy = run(exposureSignal, { meals: meals(14, 3, 2) });
    expect(heavy.value).toBeLessThan(light.value);
    expect(light.parts[0].read).not.toBe("room_to_grow");
    expect(heavy.parts[0].read).toBe("room_to_grow");
    expect(heavy.notes.join(" ")).toMatch(/Added\/refined sugar/);
  });

  test("logging more never counts against you: the same share, twice the entries, reads (nearly) the same with more confidence", () => {
    const once = run(exposureSignal, { meals: meals(10, 2, 4) });
    const twice = run(exposureSignal, { meals: [...meals(10, 2, 4), ...meals(10, 2, 4)] });
    expect(Math.abs(twice.value - once.value)).toBeLessThanOrEqual(4); // only the lean toward a typical pattern eases as evidence grows
    expect(twice.confidence).toBeGreaterThan(once.confidence);
  });

  test("with few entries, one flagged meal cannot swing the reading wildly", () => {
    const clean = run(exposureSignal, { meals: [{ day: TODAY, text: "rice and beans" }, { day: TODAY, text: "salad" }, { day: TODAY, text: "porridge" }] });
    const oneFlagged = run(exposureSignal, { meals: [{ day: TODAY, text: "rice and beans" }, { day: TODAY, text: "salad" }, { day: TODAY, text: "porridge" }, { day: TODAY, text: "sports drink with red 40 and added sugar" }] });
    expect(clean.value - oneFlagged.value).toBeGreaterThan(5); // it does register
    expect(clean.value - oneFlagged.value).toBeLessThan(30); // but it does not crash the reading
    expect(oneFlagged.notes.join(" ")).toMatch(/leans toward a typical pattern/);
  });

  test("the lean fades as evidence grows: a thorough logger's own pattern shows", () => {
    expect(run(exposureSignal, { meals: meals(28, 3) }).value).toBeGreaterThanOrEqual(97);
    expect(run(exposureSignal, { meals: meals(28, 3, 1) }).value).toBeLessThanOrEqual(30);
  });

  test("swapping a flagged entry for a clean one raises the reading", () => {
    const base = meals(7, 2, 3);
    const better = base.map((m, i) => (i === 0 ? { ...m, text: "rice and beans" } : m));
    expect(run(exposureSignal, { meals: better }).value).toBeGreaterThanOrEqual(run(exposureSignal, { meals: base }).value);
    expect(run(exposureSignal, { meals: better }).value).toBeGreaterThan(run(exposureSignal, { meals: base }).value - 0.0001);
  });

  test("scanned products are catalog entries: they neither flag nor count as evidence", () => {
    const scans = days(5).map((day) => ({ day, text: "Oat granola bar", notes: "Scanned label. Contains: Added/refined sugar." }));
    const r = run(exposureSignal, { meals: scans });
    expect(r.confidence).toBe(0);
  });

  test("older days count for less: the same flagged entry hurts less after ten days than after one", () => {
    const at = (flagDay: string) => run(exposureSignal, { meals: [...meals(10, 2), { day: flagDay, text: "cereal with added sugar" }] }).value;
    expect(at("2026-09-24")).toBeLessThan(at("2026-09-15") + 1e-9);
  });

  test("evaluated as of an earlier day, later entries do not exist", () => {
    const f = { meals: [...meals(10, 2, 0, "2026-09-10"), ...days(6).map((day) => ({ day, text: "cereal with added sugar and red 40" }))] };
    const early = run(exposureSignal, f, "2026-09-10");
    expect(early.value).toBeGreaterThanOrEqual(94);
    expect(run(exposureSignal, f, TODAY).value).toBeLessThan(early.value);
  });

  test("a quiet spell fades the confidence gradually instead of erasing the picture", () => {
    const f = { meals: meals(20, 3, 6, "2026-09-11") }; // steady logging until 14 days ago
    const now = run(exposureSignal, f, "2026-09-11");
    const week = run(exposureSignal, f, "2026-09-18");
    const fortnight = run(exposureSignal, f, TODAY);
    expect(Math.abs(week.value - now.value)).toBeLessThan(6); // the reading holds: the same pattern (it only leans a little more toward typical as evidence thins)
    expect(week.confidence).toBeLessThan(now.confidence);
    expect(fortnight.confidence).toBeLessThan(week.confidence);
    expect(week.confidence).toBeGreaterThan(0.7);
    expect(fortnight.confidence).toBeGreaterThan(0.4);
  });

  test("air-quality readings are entries too", () => {
    const r = run(exposureSignal, { air: days(4).map((day) => ({ day, value: 60 })) });
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.value).toBeLessThan(100);
  });
});

describe("shelf: your products read against the stance rules", () => {
  const clean = (n: number, addedDay = "2026-09-01") => Array.from({ length: n }, (_, i) => ({ name: `Oats ${i}`, ingredients: "oats, water, salt", addedDay, kind: "food" as const }));
  const flagged = (name: string, addedDay = "2026-09-01") => ({ name, ingredients: "water, sodium laureth sulfate, fragrance, methylparaben, dmdm hydantoin, phenoxyethanol", addedDay });

  test("an empty shelf has no evidence", () => {
    const r = run(shelfSignal, {});
    expect(r.confidence).toBe(0);
    expect(r.summary).toMatch(/nothing on your shelf/i);
  });

  test("clean products read high; a flagged one lowers the share, and retiring it brings it back", () => {
    const withBad = run(shelfSignal, { shelf: [...clean(5), flagged("Fragranced shampoo")] });
    const retired = run(shelfSignal, { shelf: [...clean(5), { ...flagged("Fragranced shampoo"), removedDay: "2026-09-20" }] });
    expect(run(shelfSignal, { shelf: clean(6) }).value).toBeGreaterThanOrEqual(99);
    expect(withBad.value).toBeLessThan(90);
    expect(retired.value).toBeGreaterThan(withBad.value + 10);
    expect(withBad.notes.join(" ")).toMatch(/Fragranced shampoo/);
  });

  test("no early floor: a typical mixed shelf still has room to move, and a swap shows", () => {
    const mixed = [...clean(4), flagged("Shampoo"), flagged("Body wash"), { name: "Lotion", ingredients: "water, glycerin, methylparaben", addedDay: "2026-09-01" }, { name: "Cereal", ingredients: "sugar, red 40, yellow 5, bht", addedDay: "2026-09-01", kind: "food" as const, nova: 4 as const }];
    const before = run(shelfSignal, { shelf: mixed });
    expect(before.value).toBeGreaterThan(20);
    expect(before.value).toBeLessThan(85);
    const swapped = run(shelfSignal, { shelf: mixed.map((p) => (p.name === "Shampoo" ? { ...p, removedDay: "2026-09-20" } : p)).concat([{ name: "Sulfate-free shampoo", ingredients: "water, coco-glucoside, glycerin", addedDay: "2026-09-20" }]) });
    expect(swapped.value - before.value).toBeGreaterThanOrEqual(5);
  });

  test("scanning more clean products never lowers it", () => {
    const base = [...clean(3), flagged("Shampoo")];
    expect(run(shelfSignal, { shelf: [...base, ...clean(4)] }).value).toBeGreaterThanOrEqual(run(shelfSignal, { shelf: base }).value);
  });

  test("retiring any flagged product can only raise it, even while heavier ones remain (the soak run's finding)", () => {
    const heavy = { name: "Sweet cereal", ingredients: "sugar, red 40, yellow 5, bht, tbhq", addedDay: "2026-09-01", kind: "food" as const, nova: 4 as const, frequency: "daily" as const };
    const mild = { name: "Granola bar", ingredients: "oats, honey, soy lecithin, natural flavors", addedDay: "2026-09-01", kind: "food" as const, frequency: "weekly" as const };
    const shelf = [heavy, { ...heavy, name: "Cola", ingredients: "carbonated water, caramel color, phosphoric acid, aspartame", nova: 4 as const }, mild, flagged("Shampoo")];
    const before = run(shelfSignal, { shelf });
    for (const victim of shelf) {
      const after = run(shelfSignal, { shelf: shelf.map((p) => (p === victim ? { ...p, removedDay: "2026-09-20" } : p)) });
      expect(after.value).toBeGreaterThanOrEqual(before.value);
    }
  });

  test("it approaches zero only as flagged products pile up, and never sits on its floor for a normal shelf", () => {
    const eight = Array.from({ length: 8 }, (_, i) => flagged(`Product ${i}`));
    expect(run(shelfSignal, { shelf: eight }).value).toBeGreaterThan(15);
    expect(run(shelfSignal, { shelf: eight }).value).toBeLessThan(35);
    expect(run(shelfSignal, { shelf: [...clean(6), flagged("One")] }).value).toBeGreaterThan(70);
  });

  test("confidence grows with the number of products, up to a fuller picture", () => {
    expect(run(shelfSignal, { shelf: clean(1) }).confidence).toBeCloseTo(1 / 6, 2);
    expect(run(shelfSignal, { shelf: clean(6) }).confidence).toBe(1);
    expect(run(shelfSignal, { shelf: clean(9) }).confidence).toBe(1);
  });

  test("evaluated as of an earlier day, products added later are not on the shelf yet", () => {
    const f = { shelf: [...clean(2, "2026-09-01"), flagged("Later shampoo", "2026-09-20")] };
    expect(run(shelfSignal, f, "2026-09-10").confidence).toBeCloseTo(2 / 6, 2);
    expect(run(shelfSignal, f, TODAY).confidence).toBeCloseTo(3 / 6, 2);
  });

  test("how often you use a product matters: the same product reads heavier when daily than rarely", () => {
    const daily = run(shelfSignal, { shelf: [{ ...flagged("Shampoo"), frequency: "daily" as const }] });
    const rare = run(shelfSignal, { shelf: [{ ...flagged("Shampoo"), frequency: "rare" as const }] });
    expect(daily.value).toBeLessThan(rare.value);
  });
});

describe("adding good: compared with guidelines where they exist", () => {
  const sleepNights = (minutes: number, count = 28) => days(count).map((day) => ({ day, type: "sleep" as const, minutes }));
  const activeDays = (minutes: number, count = 28) => days(count).map((day) => ({ day, activeMinutes: minutes }));

  test("targets follow the person's age, from the published tables", () => {
    expect(habitTargets(34).sleepMinPerNight).toBe(420);
    expect(habitTargets(15).sleepMinPerNight).toBe(480);
    expect(habitTargets(9).sleepMinPerNight).toBe(540);
    expect(habitTargets(70).sleepSource).toMatch(/7-8 hours/);
    expect(habitTargets(34).exerciseMinPerWeek).toBe(150);
    expect(habitTargets(15).exerciseMinPerWeek).toBe(420);
    expect(habitTargets(null).exerciseMinPerWeek).toBe(150);
  });

  test("nothing recorded: no evidence, and no habit is scored as zero", () => {
    const r = run(habitsSignal, {});
    expect(r.confidence).toBe(0);
    expect(r.parts.every((p) => p.read === "not_enough_yet")).toBe(true);
  });

  test("meeting the activity guideline reads on target", () => {
    // 22 active minutes every day is about 154 a week
    const r = run(habitsSignal, { metrics: activeDays(22) });
    const movement = r.parts.find((p) => p.label === "Movement")!;
    expect(movement.read).toBe("on_target");
    expect(movement.against).toMatch(/150 minutes a week/);
    expect(movement.ratio).toBe(1);
  });

  test("half the guideline reads as half, and the reading says so in numbers", () => {
    const r = run(habitsSignal, { metrics: activeDays(11) });
    const movement = r.parts.find((p) => p.label === "Movement")!;
    expect(movement.ratio).toBeCloseTo(0.51, 1);
    expect(movement.read).toBe("room_to_grow");
    expect(movement.measured).toMatch(/77 minutes a week/);
  });

  test("a teenager is held to the teen sleep range, an adult to the adult one", () => {
    const adult = run(habitsSignal, { practices: sleepNights(450), profile: { ageYears: 34 } });
    const teen = run(habitsSignal, { practices: sleepNights(450), profile: { ageYears: 15 } });
    const adultSleep = adult.parts.find((p) => p.label === "Sleep")!;
    const teenSleep = teen.parts.find((p) => p.label === "Sleep")!;
    expect(adultSleep.read).toBe("on_target");
    expect(teenSleep.ratio).toBeCloseTo(450 / 480, 2);
    expect(teenSleep.against).toMatch(/8-10 hours/);
    expect(teenSleep.read).toBe("close");
  });

  test("only what is recorded counts: nightly sleep alone leaves the other habits out, not at zero", () => {
    const r = run(habitsSignal, { practices: sleepNights(450) });
    expect(r.value).toBe(100);
    expect(r.confidence).toBeCloseTo(0.3, 2);
    expect(r.parts.find((p) => p.label === "Movement")!.read).toBe("not_enough_yet");
  });

  test("hydration and resets are compared with the app's own rhythm, and labelled as that", () => {
    const water = days(28).filter((_, i) => i % 7 !== 6).map((day) => ({ day, type: "hydration" as const }));
    const r = run(habitsSignal, { practices: water });
    const h = r.parts.find((p) => p.label === "Hydration")!;
    expect(h.basis).toBe("cadence");
    expect(h.against).toMatch(/app's habit rhythm/);
    expect(h.read).toBe("on_target");
  });

  test("recent weeks count more than older ones", () => {
    const recentActive = run(habitsSignal, { metrics: [...days(14).map((day) => ({ day, activeMinutes: 25 })), ...days(14, "2026-09-11").map((day) => ({ day, activeMinutes: 0 }))] });
    const oldActive = run(habitsSignal, { metrics: [...days(14).map((day) => ({ day, activeMinutes: 0 })), ...days(14, "2026-09-11").map((day) => ({ day, activeMinutes: 25 }))] });
    expect(recentActive.value).toBeGreaterThan(oldActive.value);
  });

  test("check-in moods are compared with the week before, in words", () => {
    const mk = (day: string, mood: "good" | "okay" | "rough") => ({ day, mood });
    const note = moodNote(
      makeData({ checkins: [...days(7).map((d, i) => mk(d, i < 5 ? "good" : "okay")), ...days(7, "2026-09-18").map((d, i) => mk(d, i < 2 ? "good" : "rough"))] }).checkins,
      TODAY
    );
    expect(note).toBe("Check-ins: 5 of the last 7 felt good, compared with 2 of the 7 the week before.");
    expect(moodNote(makeData({ checkins: [mk(TODAY, "good")] }).checkins, TODAY)).toBeNull();
  });
});

describe("validation: checked against your body", () => {
  test("no biomarker: no evidence, and it says how to begin", () => {
    const r = run(validationSignal, {});
    expect(r.confidence).toBe(0);
    expect(r.notes.join(" ")).toMatch(/one real reading/i);
  });

  test("freshness eases continuously from the quarterly cadence rather than in steps", () => {
    expect(freshnessValue(0)).toBe(100);
    expect(freshnessValue(90)).toBe(100);
    expect(freshnessValue(135)).toBeCloseTo(80, 6);
    expect(freshnessValue(180)).toBeCloseTo(60, 6);
    expect(freshnessValue(270)).toBe(20);
    expect(freshnessValue(900)).toBe(20);
    for (let d = 90; d < 270; d += 10) expect(freshnessValue(d + 10)).toBeLessThan(freshnessValue(d));
  });

  test("a reading within the quarter reads on target; an older one reads room to grow", () => {
    expect(run(validationSignal, { biomarkers: [{ day: "2026-08-20", metric: "Resting heart rate", value: 62, unit: "bpm" }] }).parts[0].read).toBe("on_target");
    expect(run(validationSignal, { biomarkers: [{ day: "2026-01-20", metric: "Resting heart rate", value: 62, unit: "bpm" }] }).parts[0].read).toBe("room_to_grow");
  });

  test("the latest reading is compared with your own previous one, in words and without a verdict", () => {
    const note = changeNote(makeData({ biomarkers: [{ day: "2026-06-20", metric: "Resting heart rate", value: 66, unit: "bpm" }, { day: "2026-09-20", metric: "resting heart rate", value: 62, unit: "bpm" }] }).biomarkers);
    expect(note).toMatch(/66 -> 62 bpm/);
    expect(note).toMatch(/lower than your own previous reading/);
    expect(note).toMatch(/not a verdict/);
    expect(changeNote(makeData({ biomarkers: [{ day: "2026-06-20", metric: "Vitamin D", value: 30 }] }).biomarkers)).toBeNull();
  });

  test("evaluated as of an earlier day, later readings do not exist yet", () => {
    const f = { biomarkers: [{ day: "2026-09-20", metric: "Vitamin D", value: 30 }] };
    expect(run(validationSignal, f, "2026-09-10").confidence).toBe(0);
    expect(run(validationSignal, f, TODAY).confidence).toBe(0.5);
  });

  test("one reading anchors the picture; each further one in the year makes it more trustworthy, without a jump", () => {
    const readings = (n: number) => Array.from({ length: n }, (_, i) => ({ day: `2026-0${9 - i}-1${i}`, metric: "Resting heart rate", value: 62 + i, unit: "bpm" }));
    const conf = (n: number) => run(validationSignal, { biomarkers: readings(n) }).confidence;
    expect([conf(1), conf(2), conf(3), conf(4)]).toEqual([0.5, 0.75, 0.875, 0.9375]);
    expect(evidenceFrom(0)).toBe(0);
  });
});

describe("understanding: progress through the curriculum", () => {
  test("not started has no evidence; each lesson moves it", () => {
    expect(run(understandingSignal, {}).confidence).toBe(0);
    const some = run(understandingSignal, { lessons: [{ day: "2026-09-20", index: 0 }, { day: "2026-09-21", index: 1 }] });
    // the reading counts in proportion to the lessons behind it, so the first lesson cannot tug the whole score
    expect(some.confidence).toBeCloseTo(2 / 22, 2);
    expect(run(understandingSignal, { lessons: [{ day: "2026-09-20", index: 0 }] }).confidence).toBeLessThanOrEqual(0.05);
    expect(some.value).toBeCloseTo((2 / 22) * 100, 0);
    expect(some.parts[0].measured).toBe("2 of 22 lessons");
    expect(some.notes.join(" ")).toMatch(/last learned something 4 days ago/);
  });

  test("evaluated as of an earlier day, later lessons are not learned yet", () => {
    const f = { lessons: [{ day: "2026-09-20", index: 0 }, { day: "2026-09-24", index: 1 }] };
    expect(run(understandingSignal, f, "2026-09-22").parts[0].measured).toBe("1 of 22 lessons");
  });
});

describe("understanding: recall on what was read", () => {
  const lessonA = LESSONS[0].id;
  const [qa1, qa2] = checksForLesson(lessonA);
  const [qb1] = checksForLesson(LESSONS[1].id);
  const read = { lessons: [{ day: "2026-09-10", index: 0 }] };

  test("a right answer on a lesson that was read adds to the reading; the evidence behind it does not move", () => {
    const before = run(understandingSignal, read, "2026-09-20");
    const after = run(understandingSignal, { ...read, checks: [{ day: "2026-09-11", id: qa1.id, correct: true }] }, "2026-09-20");
    expect(after.value).toBeCloseTo(before.value + RECALL_BONUS_POINTS / CONCEPT_CHECKS.length, 5);
    expect(after.confidence).toBe(before.confidence);
    const recall = after.parts.find((p) => p.label === "Recall")!;
    expect(recall.measured).toMatch(/^1 of 2 questions/);
    expect(recall.measured).toMatch(/1 not tried yet/);
  });

  test("a wrong answer adds nothing and takes nothing away", () => {
    const before = run(understandingSignal, read, "2026-09-20");
    const missed = run(understandingSignal, { ...read, checks: [{ day: "2026-09-11", id: qa1.id, correct: false }] }, "2026-09-20");
    expect(missed.value).toBe(before.value);
    // ... and a slip after a right answer does not take the credit back either
    const slipped = run(understandingSignal, { ...read, checks: [{ day: "2026-09-11", id: qa1.id, correct: true }, { day: "2026-09-18", id: qa1.id, correct: false }] }, "2026-09-20");
    const got = run(understandingSignal, { ...read, checks: [{ day: "2026-09-11", id: qa1.id, correct: true }] }, "2026-09-20");
    expect(slipped.value).toBe(got.value);
  });

  test("answers about a lesson that has not been read count for nothing", () => {
    const base = run(understandingSignal, read, "2026-09-20");
    const stray = run(understandingSignal, { ...read, checks: [{ day: "2026-09-11", id: qb1.id, correct: true }] }, "2026-09-20");
    expect(stray.value).toBe(base.value);
    // and once that lesson is read, the answer given earlier counts from then on
    const later = run(understandingSignal, { lessons: [...read.lessons, { day: "2026-09-15", index: 1 }], checks: [{ day: "2026-09-11", id: qb1.id, correct: true }] }, "2026-09-20");
    const without = run(understandingSignal, { lessons: [...read.lessons, { day: "2026-09-15", index: 1 }] }, "2026-09-20");
    expect(later.value).toBeGreaterThan(without.value);
  });

  test("as of an earlier day, an answer not yet given is not counted", () => {
    const f = { ...read, checks: [{ day: "2026-09-18", id: qa1.id, correct: true }] };
    expect(run(understandingSignal, f, "2026-09-15").value).toBe(run(understandingSignal, read, "2026-09-15").value);
    expect(run(understandingSignal, f, "2026-09-18").value).toBeGreaterThan(run(understandingSignal, read, "2026-09-18").value);
  });

  test("ideas come back on their own schedule, and the reading says so", () => {
    const f = { ...read, checks: [{ day: "2026-09-11", id: qa1.id, correct: true }, { day: "2026-09-11", id: qa2.id, correct: false }] };
    // both were answered on the 11th: due on the 12th, whether right (1 day) or wrong (back tomorrow)
    expect(run(understandingSignal, f, "2026-09-11").notes.join(" ")).not.toMatch(/due for a quick review/);
    expect(run(understandingSignal, f, "2026-09-12").notes.join(" ")).toMatch(/2 ideas are due for a quick review/);
  });

  test("never above 100, even with the whole curriculum read and every question answered right", () => {
    const lessons = LESSONS.map((_, index) => ({ day: "2026-09-01", index }));
    const checks = CONCEPT_CHECKS.map((c) => ({ day: "2026-09-02", id: c.id, correct: true }));
    const r = run(understandingSignal, { lessons, checks }, "2026-09-20");
    expect(r.value).toBe(100);
    expect(r.confidence).toBe(1);
  });

  test("as time passes and more is answered, the reading never falls (random practice, many seeds)", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    for (let trial = 0; trial < 40; trial++) {
      const lessons: { day: string; index: number }[] = [];
      const checks: { day: string; id: string; correct: boolean }[] = [];
      let last = -1;
      let lastConf = -1;
      for (let d = 1; d <= 28; d++) {
        const day = `2026-09-${String(d).padStart(2, "0")}`;
        if (rnd() < 0.25 && lessons.length < LESSONS.length) lessons.push({ day, index: lessons.length });
        for (let k = 0; k < 3; k++) if (rnd() < 0.5) checks.push({ day, id: CONCEPT_CHECKS[Math.floor(rnd() * CONCEPT_CHECKS.length)].id, correct: rnd() < 0.6 });
        const r = run(understandingSignal, { lessons, checks }, day);
        expect(r.value).toBeGreaterThanOrEqual(last);
        expect(r.confidence).toBeGreaterThanOrEqual(lastConf);
        expect(r.value).toBeLessThanOrEqual(100);
        last = r.value;
        lastConf = r.confidence;
      }
    }
  });

  test("the wording stays calm: nothing about failing, wrong answers or being behind", () => {
    const f = { ...read, checks: [{ day: "2026-09-11", id: qa1.id, correct: false }, { day: "2026-09-11", id: qa2.id, correct: false }] };
    const r = run(understandingSignal, f, "2026-09-20");
    const text = JSON.stringify(r.parts) + r.notes.join(" ") + r.summary;
    expect(text).not.toMatch(/\b(fail|failed|failing|wrong|behind|poor|bad|weak)\b/i);
  });
});

describe("every signal speaks in comparisons", () => {
  const rich: Fixture = {
    meals: meals(14, 2, 3),
    practices: [...days(14).map((day) => ({ day, type: "sleep" as const, minutes: 420 })), ...days(14).map((day) => ({ day, type: "hydration" as const }))],
    metrics: days(14).map((day) => ({ day, activeMinutes: 20 })),
    biomarkers: [{ day: "2026-09-01", metric: "Resting heart rate", value: 64, unit: "bpm" }],
    lessons: [{ day: "2026-09-10", index: 0 }],
    shelf: [{ name: "Shampoo", ingredients: "water, sodium laureth sulfate, fragrance", addedDay: "2026-09-01" }],
  };

  test.each([exposureSignal, habitsSignal, validationSignal, shelfSignal, understandingSignal].map((s) => [s.key, s] as const))("%s: a value, its evidence, and what it was compared with", (_key, signal) => {
    const r = signal.evaluate({ asOf: TODAY, data: makeData(rich) });
    expect(r.value).toBeGreaterThanOrEqual(0);
    expect(r.value).toBeLessThanOrEqual(100);
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
    expect(r.parts.length).toBeGreaterThan(0);
    for (const p of r.parts) {
      expect(p.label.length).toBeGreaterThan(2);
      expect(p.measured.length).toBeGreaterThan(2);
      expect(p.against.length).toBeGreaterThan(5);
      expect(["guideline", "reference_rules", "cadence", "curriculum", "own_baseline"]).toContain(p.basis);
      if (p.ratio !== null) expect(p.ratio).toBeGreaterThanOrEqual(0);
    }
    expect(r.summary.length).toBeGreaterThan(10);
  });

  test("the wording never uses alarm vocabulary", () => {
    const forbidden = ["risk", "danger", "toxic", "unsafe", "bad", "fail", "worse", "poor"];
    for (const s of [exposureSignal, habitsSignal, validationSignal, shelfSignal, understandingSignal]) {
      const r = s.evaluate({ asOf: TODAY, data: makeData(rich) });
      // a lesson's own title is curriculum content, not the signal's wording
      const text = [r.summary, ...r.notes.filter((n) => !n.startsWith("Next lesson:")), ...r.parts.flatMap((p) => [p.label, p.measured, p.against])].join(" ").toLowerCase();
      for (const word of forbidden) expect({ signal: s.key, word, found: new RegExp(`\\b${word}\\b`).test(text) }).toEqual({ signal: s.key, word, found: false });
    }
  });
});
