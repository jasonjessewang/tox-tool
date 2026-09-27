import { phraseMatcher, isNegated } from "./textMatch";

const mentions = (phrases: string[], text: string) => phraseMatcher(phrases)(text);

describe("whole words only", () => {
  test.each([
    ["voc", "avocado toast with a poached egg"],
    ["thm", "steady sleep rhythm this week"],
    ["cured", "the door was secured"],
    ["perc", "70 percent dark chocolate"],
    ["bha", "vegetable bhaji"],
    ["smoke", "smoked salmon bagel"],
    ["bell", "the doorbell rang"],
    ["blue 1", "blue 12 sports drink"],
  ])("%s is not found inside %s", (phrase, text) => {
    expect(mentions([phrase], text)).toBe(false);
  });

  test.each([
    ["voc", "new paint, VOCs all over the hallway"],
    ["cured", "cured salmon on rye"],
    ["perc", "picked up the dry cleaning -- perc smell"],
    ["bha", "ingredients: wheat flour, BHA, salt"],
    ["smoke", "wildfire smoke all afternoon"],
    ["blue 1", "candy with blue 1 and yellow 5"],
  ])("%s is found in %s", (phrase, text) => {
    expect(mentions([phrase], text)).toBe(true);
  });

  test("regex characters in a phrase are literal", () => {
    expect(mentions(["pm2.5"], "pm2.5 alert today")).toBe(true);
    expect(mentions(["pm2.5"], "pm2x5 alert today")).toBe(false);
    expect(mentions(["2,4-d"], "sprayed 2,4-d on the lawn")).toBe(true);
  });
});

describe("plurals and separators", () => {
  test("a plural phrase finds its singular and the reverse", () => {
    expect(mentions(["apples"], "an apple a day")).toBe(true);
    expect(mentions(["apples"], "two apples")).toBe(true);
    expect(mentions(["strawberries"], "one strawberry")).toBe(true);
    expect(mentions(["peaches"], "grilled peach")).toBe(true);
    expect(mentions(["avocados"], "avocado toast")).toBe(true);
    expect(mentions(["phthalates"], "phthalate-containing fragrance")).toBe(true);
    expect(mentions(["candle"], "three scented candles")).toBe(true);
  });

  test("a plural does not leak into a longer word", () => {
    expect(mentions(["apples"], "pineapple chunks")).toBe(false);
    expect(mentions(["candle"], "candlelit dinner")).toBe(false);
  });

  test("hyphen and space are the same separator", () => {
    expect(mentions(["high fructose corn syrup"], "high-fructose corn syrup")).toBe(true);
    expect(mentions(["quaternium-15"], "quaternium 15")).toBe(true);
    expect(mentions(["non-stick"], "a non stick pan")).toBe(true);
  });
});

describe("negation", () => {
  test.each([
    "sugar-free gum",
    "sugar free gum",
    "no added sugar",
    "no sugar in my coffee",
    "made without sugar",
    "free of sugar",
    "non-sugar sweetener",
  ])("'%s' does not count as a mention of sugar", (text) => {
    expect(mentions(["sugar"], text)).toBe(false);
  });

  test("only the negated occurrence is ignored", () => {
    expect(mentions(["sugar"], "no sugar in the coffee but sugar in the dessert")).toBe(true);
    expect(mentions(["bpa"], "bpa-free bottle and a bpa-lined can")).toBe(true);
    expect(mentions(["bpa"], "bpa-free bottle and a bpa free can")).toBe(false);
  });

  test("'added sugar' is a mention; the word 'added' alone is not negation", () => {
    expect(mentions(["sugar"], "cereal with red 40 and added sugar")).toBe(true);
    expect(isNegated("no added sugar", 9, 14)).toBe(true);
    expect(isNegated("cereal and added sugar", 17, 22)).toBe(false);
  });

  test("'no' inside a word is not negation", () => {
    expect(mentions(["sugar"], "casino sugar cookies")).toBe(true);
  });
});
