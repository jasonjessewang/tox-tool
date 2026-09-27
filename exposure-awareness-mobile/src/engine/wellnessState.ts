import * as db from "../storage/db";
import { composeWellnessScore, compareWithEarlier, normalizeWeights, DEFAULT_WEIGHTS, type WeightKey, type WellnessScore } from "./wellnessScore";
import { SIGNALS } from "./signals/registry";
import { loadSignalData, HISTORY_WEEKS } from "./signals/context";
import { BASELINE_DAYS } from "./signals/decay";
import type { SignalData, SignalResult } from "./signals/types";
import { daysAgoISO, endOfDay, todayISO } from "../util/dates";

export async function getScoreWeights(): Promise<Record<WeightKey, number>> {
  const stored = await db.getScoreWeights();
  return stored ? normalizeWeights(stored) : { ...DEFAULT_WEIGHTS };
}

export async function saveScoreWeights(weights: Record<WeightKey, number>): Promise<void> {
  await db.saveScoreWeights(weights);
}

/** Every signal, evaluated as of one day: nothing recorded after it exists as far as they are concerned. */
export function evaluateAll(data: SignalData, asOf: string): SignalResult[] {
  return SIGNALS.map((s) => s.evaluate({ asOf, data }));
}

/** The score as of a day, with every part compared against the person's own self four weeks earlier. Pure: no storage. */
export function scoreAsOf(data: SignalData, weights: Partial<Record<WeightKey, number>>, asOf: string): WellnessScore {
  const earlierDay = daysAgoISO(BASELINE_DAYS, endOfDay(asOf));
  return compareWithEarlier(composeWellnessScore(evaluateAll(data, asOf), weights, asOf), composeWellnessScore(evaluateAll(data, earlierDay), weights, earlierDay));
}

export async function getWellnessScore(weights?: Record<WeightKey, number>, now: Date = new Date()): Promise<WellnessScore> {
  const [data, w] = await Promise.all([loadSignalData(now), weights ?? getScoreWeights()]);
  return scoreAsOf(data, w, todayISO(now));
}

export interface ScorePoint {
  asOf: string;
  overall: number;
  coverage: number;
  provisional: boolean;
}

/** The score at the end of each of the last few weeks, oldest first: how it has moved, read from the same records. */
export async function getScoreHistory(weeks = HISTORY_WEEKS, weights?: Record<WeightKey, number>, now: Date = new Date()): Promise<ScorePoint[]> {
  const [data, w] = await Promise.all([loadSignalData(now), weights ?? getScoreWeights()]);
  return Array.from({ length: weeks }, (_, i) => {
    const asOf = daysAgoISO((weeks - 1 - i) * 7, now);
    const s = composeWellnessScore(evaluateAll(data, asOf), w, asOf);
    return { asOf, overall: s.overall, coverage: s.coverage, provisional: s.provisional };
  });
}
