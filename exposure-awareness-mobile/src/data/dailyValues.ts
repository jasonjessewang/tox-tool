/**
 * Reference amounts for context ("% of a typical day's reference amount"). US FDA Daily Values
 * on the Nutrition Facts label (2016 rule; sodium, fiber, protein, cholesterol and potassium
 * confirmed against fda.gov), for a 2,000 kcal reference diet. Population reference values --
 * not personal targets.
 */
export interface NutrientDef {
  key: "calories" | "sodiumMg" | "addedSugarsG" | "satFatG" | "totalFatG" | "carbsG" | "fiberG" | "proteinG";
  label: string;
  unit: string;
  dv: number;
  /** For fiber/protein, more is not the concern. */
  limitNutrient: boolean;
}

export const NUTRIENTS: NutrientDef[] = [
  { key: "calories", label: "Calories", unit: "kcal", dv: 2000, limitNutrient: false },
  { key: "sodiumMg", label: "Sodium", unit: "mg", dv: 2300, limitNutrient: true },
  { key: "addedSugarsG", label: "Added sugars", unit: "g", dv: 50, limitNutrient: true },
  { key: "satFatG", label: "Saturated fat", unit: "g", dv: 20, limitNutrient: true },
  { key: "totalFatG", label: "Total fat", unit: "g", dv: 78, limitNutrient: false },
  { key: "carbsG", label: "Carbohydrate", unit: "g", dv: 275, limitNutrient: false },
  { key: "fiberG", label: "Fiber", unit: "g", dv: 28, limitNutrient: false },
  { key: "proteinG", label: "Protein", unit: "g", dv: 50, limitNutrient: false },
];
