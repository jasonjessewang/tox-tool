import type { Nutrition } from "./parse";

export type LabelSource = "barcode" | "photo" | "text";

export type ProductKind = "food" | "personal_care";
export type Frequency = "rare" | "weekly" | "few_week" | "daily";

export const FREQUENCY_INFO: Record<Frequency, { label: string; perWeek: number; factor: number }> = {
  rare: { label: "A couple of times a month", perWeek: 0.5, factor: 0.5 },
  weekly: { label: "About weekly", perWeek: 1, factor: 0.75 },
  few_week: { label: "A few times a week", perWeek: 3, factor: 1 },
  daily: { label: "Daily", perWeek: 7, factor: 1.5 },
};

/** A product the user keeps around and uses habitually -- exposure science cares about repeated contact. */
export interface ShelfItem {
  id: string;
  addedAt: string;
  removedAt: string | null;
  name: string;
  brand: string;
  kind: ProductKind;
  barcode: string | null;
  source: "barcode" | "photo" | "text";
  ingredientsText: string;
  nova: 1 | 2 | 3 | 4 | null;
  nutrition: Nutrition | null;
  frequency: Frequency;
  servingsPerUse: number;
}

/** What a scan/photo/paste produced, before the user has reviewed it. */
export interface ProductDraft {
  name: string;
  brand: string;
  kind: ProductKind;
  barcode: string | null;
  source: LabelSource;
  ingredientsText: string;
  nova: 1 | 2 | 3 | 4 | null;
  nutrition: Nutrition | null;
  nutritionPer100g: Nutrition | null;
  servingGrams: number | null;
}
