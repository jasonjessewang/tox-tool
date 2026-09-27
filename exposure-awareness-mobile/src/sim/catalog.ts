/**
 * What the simulated people eat, and what is on their shelves. Ingredient lists are written
 * the way real labels read (INCI names for personal care, US/EU food-label style), so the
 * engine's matcher is exercised on realistic text rather than on strings built to match.
 * Meal descriptions are free text as a person would actually type it -- some phrasing
 * deliberately does NOT name an ingredient, since that is what the substring matcher meets
 * in the wild.
 */
import type { Frequency } from "../engine/ingredients/types";
import { EMPTY_NUTRITION, type Nutrition } from "../engine/ingredients/parse";

export type Nova = 1 | 2 | 3 | 4;
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export interface MealOption {
  text: string;
  nova: Nova;
}

export interface ProductSpec {
  key: string;
  name: string;
  brand: string;
  kind: "food" | "personal_care";
  ingredients: string;
  nova: Nova | null;
  frequency: Frequency;
  servingsPerUse: number;
  nutrition?: Partial<Nutrition>;
  /** What this person would switch to if the engine's advice made them retire this product. */
  swapTo?: string;
}

const n = (p: Partial<Nutrition>): Nutrition => ({ ...EMPTY_NUTRITION, ...p });
export const nutritionOf = (spec: ProductSpec): Nutrition | null => (spec.nutrition ? n(spec.nutrition) : null);

export const PRODUCTS: Record<string, ProductSpec> = {
  // ---- food ----
  ramen_cup: {
    key: "ramen_cup", name: "Spicy instant noodle cup", brand: "Nongshim", kind: "food", nova: 4, frequency: "few_week", servingsPerUse: 1, swapTo: "bread_whole",
    ingredients: "Enriched wheat flour, palm oil, salt, sugar, monosodium glutamate, soy sauce powder, caramel color, red pepper, garlic, onion, disodium inosinate, BHT (to preserve freshness)",
    nutrition: { servingGrams: 86, calories: 380, totalFatG: 14, satFatG: 6, sodiumMg: 1500, carbsG: 55, fiberG: 2, totalSugarsG: 4, addedSugarsG: 3, proteinG: 8 },
  },
  triangle_kimbap: {
    key: "triangle_kimbap", name: "Tuna-mayo triangle kimbap", brand: "CU", kind: "food", nova: 4, frequency: "few_week", servingsPerUse: 1,
    ingredients: "Cooked rice, tuna, mayonnaise (soybean oil, egg yolk, vinegar, sugar), seaweed, salt, sodium benzoate, natural and artificial flavor",
    nutrition: { servingGrams: 110, calories: 240, totalFatG: 8, sodiumMg: 520, carbsG: 34, totalSugarsG: 3, addedSugarsG: 2, proteinG: 6 },
  },
  energy_drink: {
    key: "energy_drink", name: "Energy drink", brand: "Generic", kind: "food", nova: 4, frequency: "few_week", servingsPerUse: 1, swapTo: "kombucha",
    ingredients: "Carbonated water, sugar, citric acid, taurine, sodium benzoate, caffeine, caramel color, natural flavors, Blue 1, Red 40",
    nutrition: { servingGrams: 250, calories: 110, sodiumMg: 200, carbsG: 27, totalSugarsG: 27, addedSugarsG: 27 },
  },
  cereal_sweet: {
    key: "cereal_sweet", name: "Frosted oat cereal", brand: "Generic", kind: "food", nova: 4, frequency: "daily", servingsPerUse: 1, swapTo: "yogurt_plain",
    ingredients: "INGREDIENTS: Whole grain oats, sugar, corn starch, honey, salt, caramel color, trisodium phosphate, Yellow 5, Red 40, BHT added to preserve freshness. Contains 2% or less of: natural flavor, vitamin E.",
    nutrition: { servingGrams: 40, calories: 150, totalFatG: 1.5, sodiumMg: 190, carbsG: 32, fiberG: 2, totalSugarsG: 12, addedSugarsG: 10, proteinG: 2 },
  },
  canned_chili: {
    key: "canned_chili", name: "Canned beef chili", brand: "Generic", kind: "food", nova: 4, frequency: "weekly", servingsPerUse: 1,
    ingredients: "Beef, water, tomato paste, kidney beans, chili pepper, salt, sugar, spices, modified corn starch, bisphenol S (can lining)",
    nutrition: { servingGrams: 250, calories: 290, totalFatG: 11, satFatG: 5, sodiumMg: 880, carbsG: 30, fiberG: 8, totalSugarsG: 6, addedSugarsG: 2, proteinG: 18 },
  },
  hot_dogs: {
    key: "hot_dogs", name: "Beef hot dogs", brand: "Generic", kind: "food", nova: 4, frequency: "weekly", servingsPerUse: 2,
    ingredients: "Beef, water, corn syrup, salt, sodium nitrite, sodium erythorbate, natural flavor, paprika",
    nutrition: { servingGrams: 50, calories: 150, totalFatG: 13, satFatG: 5, sodiumMg: 480, carbsG: 2, totalSugarsG: 1, addedSugarsG: 1, proteinG: 5 },
  },
  soda_cola: {
    key: "soda_cola", name: "Cola", brand: "Generic", kind: "food", nova: 4, frequency: "few_week", servingsPerUse: 1,
    ingredients: "Carbonated water, high fructose corn syrup, caramel color, phosphoric acid, natural flavors, caffeine",
    nutrition: { servingGrams: 355, calories: 140, sodiumMg: 45, carbsG: 39, totalSugarsG: 39, addedSugarsG: 39 },
  },
  granola_bar: {
    key: "granola_bar", name: "Oat and honey granola bar", brand: "Generic", kind: "food", nova: 4, frequency: "few_week", servingsPerUse: 1,
    ingredients: "Oats, sugar, canola oil, honey, brown sugar syrup, rice flour, natural flavors, soy lecithin, baking soda",
    nutrition: { servingGrams: 42, calories: 190, totalFatG: 6, sodiumMg: 140, carbsG: 29, fiberG: 2, totalSugarsG: 12, addedSugarsG: 11, proteinG: 3 },
  },
  kombucha: {
    key: "kombucha", name: "Ginger kombucha", brand: "Generic", kind: "food", nova: 3, frequency: "few_week", servingsPerUse: 1,
    ingredients: "Kombucha (water, black tea, cane sugar, live cultures), ginger juice",
    nutrition: { servingGrams: 240, calories: 35, carbsG: 8, totalSugarsG: 6, addedSugarsG: 0 },
  },
  yogurt_plain: {
    key: "yogurt_plain", name: "Plain yogurt", brand: "Generic", kind: "food", nova: 1, frequency: "daily", servingsPerUse: 1,
    ingredients: "Cultured pasteurized milk, live active cultures",
    nutrition: { servingGrams: 170, calories: 100, totalFatG: 2.5, sodiumMg: 115, carbsG: 8, totalSugarsG: 7, addedSugarsG: 0, proteinG: 15 },
  },
  bread_whole: {
    key: "bread_whole", name: "Whole wheat bread", brand: "Generic", kind: "food", nova: 3, frequency: "daily", servingsPerUse: 2,
    ingredients: "Whole wheat flour, water, yeast, salt, sunflower oil",
    nutrition: { servingGrams: 38, calories: 100, totalFatG: 1.5, sodiumMg: 170, carbsG: 18, fiberG: 3, totalSugarsG: 2, addedSugarsG: 0, proteinG: 4 },
  },
  olive_oil: {
    key: "olive_oil", name: "Extra virgin olive oil", brand: "Generic", kind: "food", nova: 2, frequency: "daily", servingsPerUse: 1,
    ingredients: "Extra virgin olive oil",
    nutrition: { servingGrams: 14, calories: 120, totalFatG: 14, satFatG: 2, sodiumMg: 0, carbsG: 0, proteinG: 0 },
  },
  tuna_can: {
    key: "tuna_can", name: "Canned tuna in olive oil", brand: "Generic", kind: "food", nova: 3, frequency: "weekly", servingsPerUse: 1,
    ingredients: "Tuna, olive oil, salt. BPA-free can.",
    nutrition: { servingGrams: 85, calories: 160, totalFatG: 9, sodiumMg: 320, carbsG: 0, proteinG: 20 },
  },
  canned_tomatoes: {
    key: "canned_tomatoes", name: "Canned crushed tomatoes", brand: "Generic", kind: "food", nova: 3, frequency: "weekly", servingsPerUse: 1,
    ingredients: "Tomatoes, tomato juice, salt, citric acid",
    nutrition: { servingGrams: 121, calories: 40, sodiumMg: 300, carbsG: 8, fiberG: 2, totalSugarsG: 5, addedSugarsG: 0, proteinG: 2 },
  },

  // ---- personal care (INCI names, as printed) ----
  shampoo_std: {
    key: "shampoo_std", name: "Everyday shampoo", brand: "Generic", kind: "personal_care", nova: null, frequency: "daily", servingsPerUse: 1, swapTo: "shampoo_free",
    ingredients: "Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Parfum, Methylparaben, Propylparaben, Dimethicone, Sodium Chloride, CI 77891",
  },
  shampoo_free: {
    key: "shampoo_free", name: "Paraben-free shampoo", brand: "Generic", kind: "personal_care", nova: null, frequency: "daily", servingsPerUse: 1,
    ingredients: "Water, Sodium Cocoyl Isethionate, Cocamidopropyl Betaine, Glycerin, Phenoxyethanol, Citric Acid",
  },
  body_wash: {
    key: "body_wash", name: "Fragranced body wash", brand: "Generic", kind: "personal_care", nova: null, frequency: "daily", servingsPerUse: 1, swapTo: "hand_soap_plain",
    ingredients: "Water, Sodium Lauryl Sulfate, Cocamidopropyl Betaine, Fragrance, DMDM Hydantoin, Citric Acid, Tetrasodium EDTA",
  },
  hand_soap_plain: {
    key: "hand_soap_plain", name: "Plain hand soap", brand: "Generic", kind: "personal_care", nova: null, frequency: "daily", servingsPerUse: 1,
    ingredients: "Water, Sodium Cocoyl Isethionate, Glycerin, Sodium Chloride, Citric Acid",
  },
  lotion_pf: {
    key: "lotion_pf", name: "Paraben-free body lotion", brand: "Generic", kind: "personal_care", nova: null, frequency: "daily", servingsPerUse: 1,
    ingredients: "Aqua, Glycerin, Phenoxyethanol, Caprylic/Capric Triglyceride, Parfum, Ethylhexylglycerin, Tocopherol",
  },
  sunscreen: {
    key: "sunscreen", name: "Daily SPF 50 sunscreen", brand: "Generic", kind: "personal_care", nova: null, frequency: "daily", servingsPerUse: 1,
    ingredients: "Water, Homosalate, Octocrylene, Avobenzone, Retinyl Palmitate, Cyclopentasiloxane, Phenoxyethanol, Fragrance, Tocopherol",
  },
  mouthwash_tcs: {
    key: "mouthwash_tcs", name: "Antibacterial mouthwash", brand: "Generic", kind: "personal_care", nova: null, frequency: "daily", servingsPerUse: 1,
    ingredients: "Water, Alcohol, Glycerin, Sodium Lauryl Sulfate, Triclosan, Flavor, Blue 1",
  },
  deodorant_al: {
    key: "deodorant_al", name: "Antiperspirant stick", brand: "Generic", kind: "personal_care", nova: null, frequency: "daily", servingsPerUse: 1, swapTo: "deodorant_nat",
    ingredients: "Aluminum Chlorohydrate, Cyclopentasiloxane, Stearyl Alcohol, PPG-14 Butyl Ether, Fragrance, Talc",
  },
  deodorant_nat: {
    key: "deodorant_nat", name: "Natural deodorant", brand: "Generic", kind: "personal_care", nova: null, frequency: "daily", servingsPerUse: 1,
    ingredients: "Caprylic/Capric Triglyceride, Sodium Bicarbonate, Zinc Ricinoleate, Tocopherol, Essential Oils",
  },
  toner_kbeauty: {
    key: "toner_kbeauty", name: "Essence toner", brand: "K-beauty", kind: "personal_care", nova: null, frequency: "daily", servingsPerUse: 1,
    ingredients: "Water, Butylene Glycol, Glycerin, Niacinamide, Methylparaben, Parfum, Phenoxyethanol",
  },
  sheet_mask: {
    key: "sheet_mask", name: "Hydrating sheet mask", brand: "K-beauty", kind: "personal_care", nova: null, frequency: "weekly", servingsPerUse: 1,
    ingredients: "Water, Glycerin, Butylene Glycol, Phenoxyethanol, Parfum, Ethylhexylglycerin, Carbomer",
  },
  retinol_serum: {
    key: "retinol_serum", name: "Retinol night serum", brand: "Generic", kind: "personal_care", nova: null, frequency: "few_week", servingsPerUse: 1,
    ingredients: "Water, Glycerin, Retinyl Palmitate, Hyaluronic Acid, Phenoxyethanol, Parfum",
  },
  lip_balm: {
    key: "lip_balm", name: "Scented lip balm", brand: "Generic", kind: "personal_care", nova: null, frequency: "daily", servingsPerUse: 1,
    ingredients: "Beeswax, Coconut Oil, Fragrance, Tocopherol",
  },
  hand_soap_std: {
    key: "hand_soap_std", name: "Fragranced hand soap", brand: "Generic", kind: "personal_care", nova: null, frequency: "daily", servingsPerUse: 1, swapTo: "hand_soap_plain",
    ingredients: "Water, Sodium Laureth Sulfate, Cocamide MEA, Fragrance, Methylchloroisothiazolinone, DMDM Hydantoin, Blue 1",
  },
};

const M = (text: string, nova: Nova): MealOption => ({ text, nova });

export const MEALS: Record<string, Record<MealSlot, MealOption[]>> = {
  mina: {
    breakfast: [M("just an iced americano", 2), M("banana and yogurt", 1), M("toast with strawberry jam", 3), M("cereal with milk", 4), M("gimbap from the convenience store", 4)],
    lunch: [M("cafeteria rice with kimchi soup and side dishes", 3), M("instant ramyeon with egg and cheese", 4), M("tuna mayo triangle kimbap", 4), M("chicken cutlet with rice", 3), M("tteokbokki from the street stall", 3)],
    dinner: [M("pork belly with vegetables and rice", 2), M("instant noodle cup", 4), M("fried chicken with soda", 4), M("cafeteria dinner set", 3), M("sandwich and orange juice", 3)],
    snack: [M("bubble tea with brown sugar", 4), M("energy drink", 4), M("potato chips", 4), M("chocolate bar", 4), M("ice cream", 4), M("iced americano", 2)],
  },
  marcus: {
    breakfast: [M("bacon and eggs", 3), M("cereal with milk", 4), M("protein shake", 4), M("breakfast burrito from the gas station", 4), M("coffee and a donut", 4)],
    lunch: [M("chicken sandwich with fries", 4), M("leftover pasta reheated in a plastic container", 3), M("burger and soda", 4), M("salad from the grocery deli", 2), M("canned chili with crackers", 4)],
    dinner: [M("fast food takeout", 4), M("grilled chicken and rice", 2), M("hot dogs", 4), M("frozen pizza", 4), M("microwave popcorn and a beer", 4)],
    snack: [M("energy drink", 4), M("candy bar", 4), M("protein bar", 4), M("an apple", 1), M("beef jerky", 4)],
  },
  elena: {
    breakfast: [M("tostada with olive oil and tomato", 2), M("coffee with milk and a croissant", 3), M("yogurt with fruit and nuts", 1), M("toast with jam", 3)],
    lunch: [M("lentil stew with vegetables", 2), M("grilled fish with salad and bread", 2), M("paella", 3), M("gazpacho and tortilla espanola", 2), M("canned tuna salad", 3)],
    dinner: [M("vegetable soup and an omelette", 2), M("grilled chicken and roasted vegetables", 2), M("fruit and cheese", 1), M("sardines with tomato salad", 2)],
    snack: [M("almonds", 1), M("an orange", 1), M("dark chocolate", 3), M("biscuits with tea", 4)],
  },
  priya: {
    breakfast: [M("oatmeal with berries", 2), M("avocado toast", 3), M("smoothie with protein powder", 4), M("granola with yogurt", 4), M("cold brew coffee and a muffin", 4)],
    lunch: [M("burrito bowl from the office cafeteria", 3), M("salad with grilled chicken", 2), M("sushi", 3), M("leftover takeout in a plastic container", 3), M("grain bowl", 2)],
    dinner: [M("salmon with roasted vegetables", 2), M("pasta with jarred sauce", 3), M("takeout thai curry", 3), M("tacos", 3), M("veggie stir fry with tofu", 3)],
    snack: [M("kombucha", 3), M("cheese and crackers", 3), M("fruit", 1), M("trail mix", 3), M("sparkling water", 1)],
  },
};
