/**
 * "Nothing flagged" is only reassuring if something was looked at. A week with next to nothing
 * logged must not read as the best band.
 */
import { scoreLogs, AWARENESS_BANDS, SPARSE_BAND } from "./scoring";
import type { LogStore } from "./types";

const EMPTY: LogStore = { food: [], products: [], environment: [], air_quality: [], practices: [] };
const created_at = "2026-01-01T00:00:00.000Z";
const meal = (food_item: string) => ({ id: "f", log_date: "2026-01-01", meal: "lunch" as const, food_item, processing_level: null, notes: "", created_at });
const env = (detail: string) => ({ id: "e", log_date: "2026-01-01", location: "Home", condition_type: "Home", detail, notes: "", created_at });

const CLEAR = AWARENESS_BANDS[0];

test("nothing logged does not read 'Dialed In'", () => {
  const report = scoreLogs(EMPTY);
  expect(report.awareness_band).toEqual(SPARSE_BAND);
  expect(report.awareness_band.label).not.toBe(CLEAR[3]);
  expect(report.awareness_band.key).toBe("minimal");
});

test("one or two quiet entries are still too little to call a week clear", () => {
  expect(scoreLogs({ ...EMPTY, food: [meal("oatmeal")] }).awareness_band).toEqual(SPARSE_BAND);
  expect(scoreLogs({ ...EMPTY, food: [meal("oatmeal"), meal("salad")] }).awareness_band).toEqual(SPARSE_BAND);
});

test("three quiet entries, or more, is a real look at the week and reads as clear", () => {
  const report = scoreLogs({ ...EMPTY, food: [meal("oatmeal"), meal("salad"), meal("rice and beans")] });
  expect(report.awareness_band.label).toBe(CLEAR[3]);
  expect(report.awareness_band.description).toBe(CLEAR[4]);
});

test("scanned products do not count as having looked at the week", () => {
  const scans = Array.from({ length: 5 }, () => ({ ...meal("Oat granola bar"), notes: "Scanned label. Contains: nothing flagged." }));
  expect(scoreLogs({ ...EMPTY, food: scans }).awareness_band).toEqual(SPARSE_BAND);
});

test("something flagged is reported as flagged, however little was logged", () => {
  const report = scoreLogs({ ...EMPTY, environment: [env("mold behind the sink")] });
  expect(report.overall_score).toBeGreaterThanOrEqual(2);
  expect(report.awareness_band.label).not.toBe(SPARSE_BAND.label);
});

test("the wording stays non-fear-based, like every other band", () => {
  const text = `${SPARSE_BAND.label} ${SPARSE_BAND.description}`.toLowerCase();
  for (const word of ["risk", "danger", "toxic", "unsafe", "bad", "worse", "alarm", "fail"]) expect(text).not.toContain(word);
});
