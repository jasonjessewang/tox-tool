/**
 * The single normalized shape every source maps into. Adding a provider means writing
 * one adapter that emits NormalizedSample -- nothing downstream changes.
 */
export type MetricKey = "active_minutes" | "steps" | "sleep_minutes" | "active_calories" | "resting_heart_rate" | "hrv";

export const METRICS: Record<MetricKey, { unit: string; aggregate: "sum" | "avg" }> = {
  active_minutes: { unit: "min", aggregate: "sum" },
  steps: { unit: "count", aggregate: "sum" },
  sleep_minutes: { unit: "min", aggregate: "sum" },
  active_calories: { unit: "kcal", aggregate: "sum" },
  resting_heart_rate: { unit: "bpm", aggregate: "avg" },
  hrv: { unit: "ms", aggregate: "avg" },
};

export interface NormalizedSample {
  source: string;
  metric: MetricKey;
  date: string; // yyyy-mm-dd, user-local
  value: number;
  unit?: string;
  external_id: string;
}

/** Sources that push data from the device (their SDKs only exist on-device). */
export const ON_DEVICE_SOURCES = ["apple_health", "health_connect", "samsung_health", "manual"] as const;
