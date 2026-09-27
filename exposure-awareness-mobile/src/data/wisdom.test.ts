import { WISDOM, wisdomAt, dailyLearning, wisdomForTier } from "./wisdom";
import { GUIDELINES } from "./guidelines";
import { cleanTitle } from "../services/pubmed";

test("every wisdom item has an id, icon and text, and ids are unique", () => {
  for (const w of WISDOM) {
    expect(w.id).toBeTruthy();
    expect(w.icon).toBeTruthy();
    expect(w.text.length).toBeGreaterThan(10);
  }
  expect(new Set(WISDOM.map((w) => w.id)).size).toBe(WISDOM.length);
});

test("includes the Paracelsus dose quote and all concept glossary entries", () => {
  expect(WISDOM.some((w) => w.id === "paracelsus_dose" && w.text.includes("dose"))).toBe(true);
  expect(WISDOM.filter((w) => w.kind === "concept").length).toBeGreaterThanOrEqual(8);
});

test("wisdomAt wraps around and handles negative indexes", () => {
  expect(wisdomAt(WISDOM.length)).toEqual(wisdomAt(0));
  expect(wisdomAt(-1)).toEqual(wisdomAt(WISDOM.length - 1));
});

test("tone: nothing in the loading content uses alarm vocabulary", () => {
  for (const w of WISDOM) {
    const t = w.text.toLowerCase();
    for (const word of ["deadly", "danger", "you are at risk", "cancer-causing"]) {
      expect(t.includes(word)).toBe(false);
    }
  }
});

test("dailyLearning is stable within a day and changes on the next", () => {
  const a = dailyLearning(new Date(2026, 5, 10, 8));
  const b = dailyLearning(new Date(2026, 5, 10, 22));
  const c = dailyLearning(new Date(2026, 5, 11, 8));
  expect(a.id).toBe(b.id);
  expect(c.id).not.toBe(a.id);
});

test("core toxicology concepts (ADME, sensitization, dispersion) are present", () => {
  const ids = WISDOM.map((w) => w.id);
  for (const id of ["concept_adme", "concept_sensitization", "concept_dispersion", "concept_dose_response", "concept_aggregate_exposure"]) {
    expect(ids).toContain(id);
  }
});

test("verified guideline facts are in the rotation, attributed to a real authority, and never gated behind a literacy tier", () => {
  expect(GUIDELINES.length).toBeGreaterThanOrEqual(8);
  const ids = WISDOM.map((w) => w.id);
  for (const g of GUIDELINES) expect(ids).toContain(`guideline_${g.id}`);
  const guidelineItems = WISDOM.filter((w) => w.kind === "guideline");
  for (const w of guidelineItems) {
    expect(w.attribution).toBeTruthy();
    expect(w.tier ?? 1).toBe(1);
  }
  expect(wisdomForTier(1).some((w) => w.kind === "guideline")).toBe(true);
});

test("no raw literature headlines remain in the loading rotation", () => {
  expect(WISDOM.some((w) => (w.kind as string) === "literature")).toBe(false);
});

test("cleanTitle strips markup, trailing period and extra spaces", () => {
  expect(cleanTitle("A <i>study</i>  of  PFAS.")).toBe("A study of PFAS");
});

test("harder ideas are layered in with literacy: tier 1 excludes what tier 3 adds", () => {
  const t1 = wisdomForTier(1).map((w) => w.id);
  const t3 = wisdomForTier(3).map((w) => w.id);
  expect(t1).toContain("insight_tiny_baseline");
  expect(t1).not.toContain("insight_multiple");
  expect(t1).not.toContain("concept_causation_criteria");
  expect(t3).toContain("insight_multiple");
  expect(t3.length).toBe(WISDOM.length);
  for (const w of wisdomForTier(1)) expect(w.tier ?? 1).toBe(1);
});

test("daily learning respects the tier and stays stable within a day", () => {
  const d = new Date(2026, 5, 10);
  const pool = wisdomForTier(1).map((w) => w.id);
  expect(pool).toContain(dailyLearning(d, 1).id);
  expect(dailyLearning(d, 1).id).toBe(dailyLearning(new Date(2026, 5, 10, 20), 1).id);
});

test("risk-literacy insights are accurate on the numbers they state", () => {
  const tiny = WISDOM.find((w) => w.id === "insight_tiny_baseline")!;
  expect(tiny.text).toContain("1-in-10,000");
  expect(tiny.text).toContain("1 in 1,000");
  expect(WISDOM.find((w) => w.id === "insight_multiple")!.text).toContain("20 unrelated");
});
