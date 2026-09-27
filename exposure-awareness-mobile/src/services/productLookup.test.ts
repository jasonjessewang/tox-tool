import { normalizeBarcode, parseProduct, scaleNutrition } from "./productLookup";

test("normalizeBarcode keeps 8-14 digits and strips formatting", () => {
  expect(normalizeBarcode("3017 6204-22003")).toBe("3017620422003");
  expect(normalizeBarcode("123")).toBe(null);
  expect(normalizeBarcode("abc")).toBe(null);
});

test("parseProduct reads a real Open Food Facts response shape", () => {
  const p = parseProduct(
    { status: 1, product: { product_name: "Nutella", brands: "Nutella, Ferrero", ingredients_text: "Sucre, huile de palme", nova_group: 4 } },
    "3017620422003",
    "food"
  );
  expect(p).toMatchObject({ barcode: "3017620422003", kind: "food", name: "Nutella", brand: "Nutella", ingredients: "Sucre, huile de palme", nova: 4 });
});

test("a product with no name and no ingredients counts as not found", () => {
  expect(parseProduct({ status: 1, product: {} }, "8003510008490", "personal_care")).toBe(null);
  expect(parseProduct({ status: 0 }, "1", "food")).toBe(null);
});

test("invalid nova_group becomes null rather than a bogus level", () => {
  expect(parseProduct({ status: 1, product: { product_name: "X", nova_group: 9 } }, "12345678", "food")?.nova).toBe(null);
});

test("prefers the English ingredient list when the product has one", () => {
  const p = parseProduct({ status: 1, product: { product_name: "X", ingredients_text: "Sucre, huile de palme", ingredients_text_en: "Sugar, palm oil" } }, "12345678", "food");
  expect(p?.ingredients).toBe("Sugar, palm oil");
});

test("reads per-100g nutriments (sodium g -> mg) and scales them to a real serving", () => {
  const p = parseProduct({ status: 1, product: { product_name: "Spread", nutriments: { "energy-kcal_100g": 539, sodium_100g: 0.0428, "saturated-fat_100g": 10.6, "added-sugars_100g": 52.13, proteins_100g: 6.3 }, serving_quantity: 15 } }, "12345678", "food")!;
  expect(p.nutritionPer100g?.sodiumMg).toBeCloseTo(42.8);
  expect(p.servingGrams).toBe(15);
  const s = scaleNutrition(p.nutritionPer100g!, 15);
  expect(s.calories).toBeCloseTo(80.9, 1);
  expect(s.addedSugarsG).toBeCloseTo(7.8, 1);
  expect(p.nutrition).toBe(null);
});

test("products with no nutrition data simply have none", () => {
  expect(parseProduct({ status: 1, product: { product_name: "X", ingredients_text: "water" } }, "12345678", "food")?.nutritionPer100g).toBe(null);
});
