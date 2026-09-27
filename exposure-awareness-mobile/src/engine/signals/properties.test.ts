/**
 * Properties the score's parts must keep however a person's shelf or places look. The soak run found one of these broken
 * (retiring a mildly flagged product lowered the shelf part while heavier ones remained); these tests hold the line on many
 * random shelves and places rather than one that happened to be checked.
 */
import { Rng } from "../../sim/rng";
import { PRODUCTS } from "../../sim/catalog";
import { checksFor } from "../../data/placeChecks";
import { shelfSignal } from "./shelf";
import { placesSignal } from "./places";
import { makeData, type Fixture } from "./fixtures";
import type { SignalResult } from "./types";

const ASOF = "2026-09-25";
const ADDED = "2026-09-01";
const keys = Object.keys(PRODUCTS);
const shelfValue = (shelf: NonNullable<Fixture["shelf"]>): SignalResult => shelfSignal.evaluate({ asOf: ASOF, data: makeData({ shelf }) });
const product = (key: string, removed = false): NonNullable<Fixture["shelf"]>[number] => {
  const s = PRODUCTS[key];
  return { name: s.name, ingredients: s.ingredients, kind: s.kind, nova: s.nova, frequency: s.frequency, addedDay: ADDED, removedDay: removed ? "2026-09-20" : null };
};
const randomShelf = (r: Rng) => Array.from({ length: r.int(1, 14) }, () => r.pick(keys));

describe("shelf: removing and adding", () => {
  test("retiring any product can only raise the value, on many random shelves", () => {
    const r = new Rng(41);
    for (let i = 0; i < 150; i++) {
      const picked = randomShelf(r);
      if (picked.length < 2) continue; // an emptied shelf has no reading at all, so there is nothing to compare
      const before = shelfValue(picked.map((k) => product(k))).value;
      const victim = r.int(0, picked.length - 1);
      const after = shelfValue(picked.map((k, j) => product(k, j === victim))).value;
      expect(after).toBeGreaterThanOrEqual(before - 1e-9);
    }
  });

  test("adding a product can only lower the value or leave it be, never raise it", () => {
    const r = new Rng(43);
    for (let i = 0; i < 150; i++) {
      const picked = randomShelf(r);
      const before = shelfValue(picked.map((k) => product(k))).value;
      const after = shelfValue([...picked, r.pick(keys)].map((k) => product(k))).value;
      expect(after).toBeLessThanOrEqual(before + 1e-9);
    }
  });

  test("swapping a product for its suggested alternative never lowers the value", () => {
    const r = new Rng(47);
    let swaps = 0;
    for (let i = 0; i < 200; i++) {
      const picked = randomShelf(r);
      const idx = picked.findIndex((k) => PRODUCTS[k].swapTo);
      if (idx < 0) continue;
      swaps += 1;
      const before = shelfValue(picked.map((k) => product(k))).value;
      const after = shelfValue([...picked.map((k, j) => product(k, j === idx)), product(PRODUCTS[picked[idx]].swapTo!)]).value;
      expect(after).toBeGreaterThanOrEqual(before - 1e-9);
    }
    expect(swaps).toBeGreaterThan(30);
  });

  test("the value stays within its range and never sits on the floor for a shelf of a normal size", () => {
    const r = new Rng(53);
    for (let i = 0; i < 150; i++) {
      const v = shelfValue(randomShelf(r).map((k) => product(k))).value;
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe("places: answering and fixing", () => {
  const placesValue = (answers: { check: string; value: string; day: string }[], hours?: number) => placesSignal.evaluate({ asOf: ASOF, data: makeData({ places: [{ kind: "home", hours, answers }] }) });
  const homeChecks = checksFor("home");
  const randomAnswers = (r: Rng, day = ADDED) => homeChecks.filter(() => r.chance(0.6)).map((c) => ({ check: c.id, value: r.pick(c.options.filter((o) => o.status !== "unknown")).value, day }));

  test("moving any answer to one that meets the reference can only raise the value", () => {
    const r = new Rng(59);
    for (let i = 0; i < 150; i++) {
      const answers = randomAnswers(r);
      if (answers.length === 0) continue;
      const before = placesValue(answers).value;
      const idx = r.int(0, answers.length - 1);
      const check = homeChecks.find((c) => c.id === answers[idx].check)!;
      const better = check.options.find((o) => o.status === "meets")!;
      const after = placesValue(answers.map((a, j) => (j === idx ? { ...a, value: better.value } : a))).value;
      expect(after).toBeGreaterThanOrEqual(before - 1e-9);
    }
  });

  test("answering one more check with something that meets its reference never lowers the value", () => {
    const r = new Rng(61);
    for (let i = 0; i < 150; i++) {
      const answers = randomAnswers(r);
      const unanswered = homeChecks.filter((c) => !answers.some((a) => a.check === c.id));
      if (unanswered.length === 0) continue;
      const extra = r.pick(unanswered);
      const meets = extra.options.find((o) => o.status === "meets")!;
      const before = placesValue(answers).value;
      const after = placesValue([...answers, { check: extra.id, value: meets.value, day: ADDED }]).value;
      expect(after).toBeGreaterThanOrEqual(before - 1e-9);
    }
  });

  test("more evidence never means less confidence, and the value stays within its range", () => {
    const r = new Rng(67);
    for (let i = 0; i < 100; i++) {
      const answers = randomAnswers(r);
      let prev = 0;
      for (let n = 0; n <= answers.length; n++) {
        const s = placesValue(answers.slice(0, n));
        expect(s.confidence).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = s.confidence;
        if (s.confidence > 0) {
          expect(s.value).toBeGreaterThanOrEqual(5);
          expect(s.value).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});
