/**
 * "Simple" keeps its promise: the plain-language summaries are short, readable, calm, and say nothing the full summary does not.
 */
import { loadHazardDb, summaryFor } from "../engine/scoring";
import { assessProduct } from "../engine/ingredients/assess";
import { matchIngredients } from "../engine/ingredients/match";
import { parseIngredients } from "../engine/ingredients/parse";

const substances = loadHazardDb();

const syllables = (word: string) => {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  let count = (w.match(/[aeiouy]+/g) ?? []).length;
  if (w.endsWith("e") && count > 1 && !w.endsWith("le")) count -= 1;
  return Math.max(1, count);
};
/** Flesch-Kincaid grade level, with the usual crude syllable count -- good for comparing texts, not for judging one. */
export function gradeLevel(text: string): number {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const words = text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  return 0.39 * (words.length / sentences.length) + 11.8 * (syl / words.length) - 15.59;
}
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

test("every substance has a plain-language summary", () => {
  for (const s of substances) {
    expect(typeof s.summary_plain).toBe("string");
    expect((s.summary_plain ?? "").length).toBeGreaterThan(40);
  }
});

test("they read at about a grade-8 level, where the full summaries read at college level", () => {
  const plain = substances.map((s) => gradeLevel(s.summary_plain!));
  const full = substances.map((s) => gradeLevel(s.summary));
  expect(median(plain)).toBeLessThanOrEqual(9);
  expect(median(full)).toBeGreaterThan(13);
  // a few carry unavoidable long words (formaldehyde, asbestos, carcinogen); none is allowed to run away
  for (const s of substances) expect(gradeLevel(s.summary_plain!)).toBeLessThanOrEqual(12);
});

test("short enough to read on a phone at a glance, and not longer than they need to be", () => {
  for (const s of substances) {
    const words = s.summary_plain!.trim().split(/\s+/).length;
    expect(words).toBeLessThanOrEqual(70);
  }
});

test("they add no number, year or agency that the full summary does not carry", () => {
  const alias: Record<string, string[]> = { NTP: ["National Toxicology Program"], EFSA: ["European Food Safety Authority"] };
  for (const s of substances) {
    const plain = s.summary_plain!;
    const full = s.summary;
    for (const n of plain.match(/\d[\d.,]*\d|\d/g) ?? []) {
      // "2.5" may open a sentence's end as "2.5." -- compare on the digits themselves
      expect(full).toContain(n.replace(/[.,]$/, ""));
    }
    for (const agency of plain.match(/\b[A-Z]{2,5}\b/g) ?? []) {
      // chemical shorthand (BPA, THMs, PTFE, VOC, PFAS...) is checked the same way: it has to be in the full text too
      const spelled = alias[agency] ?? [];
      expect(full.includes(agency) || spelled.some((x) => full.includes(x)) || s.name.includes(agency) || /^(US|EU|FDA|UV|DNA)$/.test(agency)).toBe(true);
    }
  }
});

test("calm: no alarm words, and nothing shouted", () => {
  for (const s of substances) {
    expect(s.summary_plain).not.toMatch(/\b(toxic|toxin|toxins|deadly|dangerous|danger|unsafe|poisonous|lethal|scary|harmful chemicals?)\b/i);
    expect(s.summary_plain).not.toMatch(/!/);
  }
});

test("Simple gets the plain summary; every other level keeps the full one", () => {
  const s = substances.find((x) => x.id === "parabens")!;
  expect(summaryFor(s, "simple")).toBe(s.summary_plain);
  expect(summaryFor(s, "balanced")).toBe(s.summary);
  expect(summaryFor(s, "technical")).toBe(s.summary);
  // and a substance without a plain version falls back to the full one, never to nothing
  expect(summaryFor({ summary: "Full text.", summary_plain: undefined }, "simple")).toBe("Full text.");
});

test("a scanned product's reasons carry both wordings; the plain one uses the plain summary", () => {
  const match = matchIngredients(parseIngredients("Aqua, Sodium Laureth Sulfate, Fragrance, Methylparaben"));
  const a = assessProduct({ matches: match.matches, unmatchedCount: 0, kind: "personal_care", nova: null, frequency: "daily", profile: null });
  expect(a.reasons.length).toBeGreaterThan(0);
  for (const r of a.reasons) {
    expect(r.line.length).toBeGreaterThan(20);
    expect(r.linePlain.length).toBeGreaterThan(20);
  }
  const parabens = a.reasons.find((r) => r.substanceId === "parabens")!;
  expect(parabens.linePlain).toContain("Preservatives that keep cosmetics from spoiling.");
  expect(parabens.line).toContain("Preservatives used in cosmetics/personal care products");
});
