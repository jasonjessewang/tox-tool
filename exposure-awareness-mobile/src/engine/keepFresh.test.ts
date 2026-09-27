import { keepFresh, BIOMARKER_CADENCE_DAYS } from "./keepFresh";

const quiet = { recallDue: 0, recallUnanswered: 0, daysSinceBiomarker: null, placesUnanswered: 0 };

test("with nothing to keep current it says nothing, rather than inventing something", () => {
  expect(keepFresh(quiet)).toEqual([]);
  // a reading within the quarter is current; one that has never been logged is not nagged about here
  expect(keepFresh({ ...quiet, daysSinceBiomarker: 12 })).toEqual([]);
  expect(keepFresh({ ...quiet, daysSinceBiomarker: BIOMARKER_CADENCE_DAYS })).toEqual([]);
});

test("each thing that has aged gets one plain line, and a place to go", () => {
  const all = keepFresh({ recallDue: 2, recallUnanswered: 1, daysSinceBiomarker: 120, placesUnanswered: 3 });
  expect(all.map((l) => l.key)).toEqual(["recall", "biomarker", "places"]);
  expect(all[0]).toMatchObject({ target: "learn", segment: "engine" });
  expect(all[0].text).toBe("A quick review of three questions on lessons you've read is ready.");
  expect(all[1]).toMatchObject({ target: "log_biomarker" });
  expect(all[1].text).toMatch(/120 days old/);
  expect(all[2]).toMatchObject({ target: "places" });
  expect(all[2].text).toBe("3 more questions about your places would fill in the picture.");
});

test("the review is offered as a session of three at most, never as the size of the pile", () => {
  expect(keepFresh({ ...quiet, recallDue: 1 })[0].text).toBe("A question on a lesson you've read is ready for a quick review.");
  expect(keepFresh({ ...quiet, recallDue: 1, recallUnanswered: 1 })[0].text).toBe("Two questions on lessons you've read are ready for a quick review.");
  expect(keepFresh({ ...quiet, recallDue: 30, recallUnanswered: 12 })[0].text).toBe("A quick review of three questions on lessons you've read is ready.");
  expect(keepFresh({ ...quiet, recallDue: 30 })[0].text).not.toMatch(/\d/);
});

test("singular and plural", () => {
  expect(keepFresh({ ...quiet, placesUnanswered: 1 })[0].text).toBe("1 more question about your places would fill in the picture.");
});

test("never more than three lines, and the wording stays calm", () => {
  const all = keepFresh({ recallDue: 9, recallUnanswered: 9, daysSinceBiomarker: 400, placesUnanswered: 9 });
  expect(all.length).toBeLessThanOrEqual(3);
  for (const l of all) expect(l.text).not.toMatch(/\b(overdue|behind|neglect|missed|warning|urgent|risk|danger)\b/i);
});
