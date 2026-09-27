import { parseIngredients, parseNutritionText, parseLabelText, extractIngredientsSection } from "./parse";
import { matchIngredients } from "./match";
import { assessProduct } from "./assess";

const NUTELLA = "Sugar, vegetable fat (palm), hazelnuts (13%), skimmed milk powder (8.7%), fat-reduced cocoa powder (7.4%), emulsifier: lecithins (soya), flavouring (vanillin).";
const CEREAL = "INGREDIENTS: Whole grain oats, sugar, corn starch, honey, salt, caramel color, trisodium phosphate, Yellow 5, Red 40, BHT added to preserve freshness. Contains 2% or less of: natural flavor, vitamin E. CONTAINS: WHEAT. MANUFACTURED BY Acme Foods.";
const SHAMPOO = "Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Parfum, Methylparaben, Propylparaben, Dimethicone, Sodium Chloride, CI 77891";

describe("ingredient parsing", () => {
  test("splits at top-level commas only and keeps parenthetical sub-ingredients attached to their parent", () => {
    const p = parseIngredients(NUTELLA);
    const names = p.map((x) => x.name);
    expect(names.slice(0, 3)).toEqual(["sugar", "vegetable fat", "palm"]);
    expect(p.find((x) => x.name === "hazelnuts")?.percent).toBe(13);
    expect(p.find((x) => x.name === "palm")?.parent).toBe("vegetable fat");
    expect(p.find((x) => x.name === "soya")?.parent).toBeTruthy();
  });

  test("order gives a rough amount tier: first three major, then minor, tail trace", () => {
    const p = parseIngredients(CEREAL).filter((x) => !x.parent);
    expect(p[0]).toMatchObject({ name: "whole grain oats", tier: "major" });
    expect(p.find((x) => x.name === "sugar")?.tier).toBe("major");
    expect(p.find((x) => x.name === "bht added to preserve freshness")?.tier).toBe("trace");
  });

  test("'contains 2% or less of' marks everything after it as trace, and the allergen line is not part of the list", () => {
    const p = parseIngredients(CEREAL);
    expect(p.find((x) => x.name === "flavor")?.tier).toBe("trace");
    expect(p.find((x) => x.name === "vitamin e")?.tier).toBe("trace");
    expect(p.some((x) => x.name.includes("wheat"))).toBe(false);
    expect(extractIngredientsSection(CEREAL)).not.toMatch(/manufactured/i);
  });

  test("an allergen statement with no colon ('CONTAINS WHEAT') ends the list; 'contains one or more of' starts the trace tail", () => {
    expect(parseIngredients("oats, salt. Contains wheat.").map((x) => x.name)).toEqual(["oats", "salt"]);
    const p = parseIngredients("oats, sugar, contains one or more of the following: soy lecithin, annatto");
    expect(p.find((x) => x.name === "annatto")?.tier).toBe("trace");
  });

  test("declared percentages override position (a 13% ingredient is major even at position 3)", () => {
    const p = parseIngredients("water, salt, a 1% thing, b 30% thing");
    expect(p.find((x) => x.name.startsWith("a"))?.tier).toBe("trace");
    expect(p.find((x) => x.name.startsWith("b"))?.tier).toBe("major");
  });

  test("OCR-style text: line breaks, hyphenated wraps, and a stray header are handled", () => {
    const ocr = "NUTRITION FACTS\n...\nINGREDIENTS: SUGAR, ENRICHED FLOUR (WHEAT FLOUR,\nNIAC-\nIN), HIGH FRUCTOSE CORN SYRUP, SALT.\nCONTAINS WHEAT.";
    const p = parseIngredients(ocr).filter((x) => !x.parent);
    expect(p.map((x) => x.name)).toEqual(["sugar", "enriched flour", "high fructose corn syrup", "salt"]);
  });

  test("E-numbers are captured in several spellings", () => {
    expect(parseIngredients("colour (E171), preservative (E 250), dye (e-102)").map((x) => x.eNumber).filter(Boolean)).toEqual(["e171", "e250", "e102"]);
  });

  test("a pasted bare list with no header still parses", () => {
    expect(parseIngredients("oats, sugar, salt").length).toBe(3);
    expect(parseIngredients("")).toEqual([]);
  });
});

describe("matching", () => {
  test("finds real flags with whole-word matching, tiered by position", () => {
    const { matches } = matchIngredients(parseIngredients(CEREAL));
    const by = Object.fromEntries(matches.map((m) => [m.substanceId, m]));
    expect(by.added_sugar.tier).toBe("major");
    expect(by.artificial_food_dyes).toBeTruthy();
    expect(by.bha_bht.tier).toBe("trace");
  });

  test("personal-care INCI names and E-number/CI synonyms match", () => {
    const { matches } = matchIngredients(parseIngredients(SHAMPOO));
    const ids = matches.map((m) => m.substanceId);
    expect(ids).toEqual(expect.arrayContaining(["sodium_lauryl_sulfate", "parabens", "titanium_dioxide", "siloxanes", "phthalates"]));
  });

  test("'fragrance' is flagged as POSSIBLE, since the label doesn't say what it contains", () => {
    const m = matchIngredients(parseIngredients("water, fragrance")).matches.find((x) => x.substanceId === "phthalates");
    expect(m?.confidence).toBe("possible");
    expect(matchIngredients(parseIngredients("water, diethyl phthalate")).matches.find((x) => x.substanceId === "phthalates")?.confidence).toBe("listed");
  });

  test("false-positive traps: 'percent', 'dependable', 'sugars' and environment-only substances never match", () => {
    const text = "water, 5 percent juice, dependable thickener, dry cleaning grade solvent, mold inhibitor, total sugars";
    expect(matchIngredients(parseIngredients(text)).matches).toEqual([]);
  });

  test("negations are respected: sugar-free, BPA free, no added sugar", () => {
    expect(matchIngredients(parseIngredients("sugar-free gum base")).matches.some((m) => m.substanceId === "added_sugar")).toBe(false);
    expect(matchIngredients(parseIngredients("bpa free packaging note")).matches.some((m) => m.substanceId === "bpa")).toBe(false);
    expect(matchIngredients(parseIngredients("oats, no added sugar")).matches.some((m) => m.substanceId === "added_sugar")).toBe(false);
    expect(matchIngredients(parseIngredients("oats, sugar")).matches.some((m) => m.substanceId === "added_sugar")).toBe(true);
  });

  test("keeps the strongest tier when a substance appears twice; reports unmatched ingredients", () => {
    const r = matchIngredients(parseIngredients("oats, water, sugar, honey, salt, dextrose"));
    expect(r.matches.find((m) => m.substanceId === "added_sugar")?.tier).toBe("major");
    expect(r.unmatched).toContain("oats");
    expect(r.unmatched).not.toContain("sugar");
  });

  test("nothing matched is a normal outcome", () => {
    expect(matchIngredients(parseIngredients("oats, water, salt")).matches).toEqual([]);
  });

  test("chemical relatives of a flagged substance match under their own name, not the original's", () => {
    const bps = matchIngredients(parseIngredients("water, bisphenol s lining")).matches;
    expect(bps.map((m) => m.substanceId)).toEqual(["bisphenol_analogs"]);
    const phenoxy = matchIngredients(parseIngredients("aqua, phenoxyethanol, glycerin")).matches;
    expect(phenoxy.map((m) => m.substanceId)).toEqual(["phenoxyethanol"]);
  });
});

describe("regrettable substitution", () => {
  const assess = (text: string) =>
    assessProduct({
      matches: matchIngredients(parseIngredients(text)).matches,
      unmatchedCount: 0,
      kind: "personal_care",
      nova: null,
      frequency: "few_week",
      profile: null,
    });

  test("a BPA-free-labeled product that contains bisphenol S is flagged as a swap-in, not silently passed", () => {
    const a = assess("bpa free lining, bisphenol s");
    expect(a.substitutions).toEqual([
      expect.objectContaining({ substanceId: "bisphenol_analogs", relatedId: "bpa", relatedName: expect.stringContaining("BPA") }),
    ]);
    // The BPA-free claim is correctly NOT a false-positive match on bpa itself...
    expect(a.reasons.some((r) => r.substanceId === "bpa")).toBe(false);
    // ...but the analog's own concern_level still contributes to signal, same as any match.
    expect(a.reasons.some((r) => r.substanceId === "bisphenol_analogs")).toBe(true);
  });

  test("a paraben-free product with phenoxyethanol is flagged the same way", () => {
    const a = assess("aqua, phenoxyethanol, glycerin");
    expect(a.substitutions).toEqual([expect.objectContaining({ substanceId: "phenoxyethanol", relatedId: "parabens" })]);
  });

  test("a product with the original flagged substance (not a substitute) has no substitution note", () => {
    const a = assess("aqua, methylparaben, glycerin");
    expect(a.substitutions).toEqual([]);
    expect(a.reasons.some((r) => r.substanceId === "parabens")).toBe(true);
  });

  test("a product with neither has no substitution note and no false flags", () => {
    const a = assess("aqua, glycerin, citric acid");
    expect(a.substitutions).toEqual([]);
    expect(a.reasons).toEqual([]);
  });
});

describe("nutrition parsing", () => {
  const LABEL = `Nutrition Facts
8 servings per container
Serving size 2/3 cup (55g)
Calories 230
Total Fat 8g
Saturated Fat 1g
Cholesterol 0mg
Sodium 160mg
Total Carbohydrate 37g
Dietary Fiber 4g
Total Sugars 12g
Includes 10g Added Sugars
Protein 3g`;

  test("reads the standard US label", () => {
    const n = parseNutritionText(LABEL)!;
    expect(n).toMatchObject({ servingsPerContainer: 8, servingGrams: 55, calories: 230, totalFatG: 8, satFatG: 1, cholesterolMg: 0, sodiumMg: 160, carbsG: 37, fiberG: 4, totalSugarsG: 12, addedSugarsG: 10, proteinG: 3 });
  });

  test("converts units and handles '<1g'", () => {
    const n = parseNutritionText("Calories 90 Sodium 0.16 g Total Fat <1g Protein 2g")!;
    expect(n.sodiumMg).toBeCloseTo(160);
    expect(n.totalFatG).toBe(1);
  });

  test("refuses to guess: OCR that lost the units yields nothing rather than a wrong number", () => {
    expect(parseNutritionText("Calories 230 Total Fat 89 Sodium 1609")).toBe(null);
  });

  test("EU-style kcal and a combined label + ingredients text parse together", () => {
    const both = parseLabelText(`${LABEL}\nINGREDIENTS: OATS, SUGAR, SALT.`);
    expect(both.nutrition?.calories).toBe(230);
    expect(both.ingredientsText).toBe("OATS, SUGAR, SALT");
    expect(parseNutritionText("Energy 960 kJ / 230 kcal Fat 8 g Protein 3 g")?.calories).toBe(230);
  });

  test("text without a nutrition panel returns null", () => {
    expect(parseNutritionText("Ingredients: oats, sugar")).toBe(null);
  });
});

describe("real OCR output (verbatim tesseract text, including its misreads)", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { REAL_OCR_TEXT } = require("./ocrFixture");

  test("the ingredient list is recovered intact from wrapped, all-caps OCR lines", () => {
    const names = parseIngredients(REAL_OCR_TEXT).filter((p) => !p.parent).map((p) => p.name);
    expect(names).toEqual(["sugar", "enriched flour", "vegetable oil", "high fructose corn syrup", "salt", "red 40", "yellow 5", "bht added to preserve freshness"]);
  });

  test("the matcher flags the right substances from OCR text", () => {
    const ids = matchIngredients(parseIngredients(REAL_OCR_TEXT)).matches.map((m) => m.substanceId);
    expect(ids).toEqual(expect.arrayContaining(["added_sugar", "artificial_food_dyes", "bha_bht"]));
  });

  test("nutrition values are read, and the OCR misread '(559)' for '(55g)' is NOT trusted as a serving weight", () => {
    const n = parseNutritionText(REAL_OCR_TEXT)!;
    expect(n).toMatchObject({ calories: 230, totalFatG: 8, sodiumMg: 160, carbsG: 37, addedSugarsG: 10, proteinG: 3 });
    expect(n.servingGrams).toBe(null);
  });

  test("the combined label parses both halves at once", () => {
    const l = parseLabelText(REAL_OCR_TEXT);
    expect(l.ingredientsText.toLowerCase()).toContain("high fructose corn syrup");
    expect(l.nutrition?.calories).toBe(230);
  });
});
