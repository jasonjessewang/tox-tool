import * as db from "../../storage/db";
import { loadHazardDb, tallyDay, type DayTally } from "../scoring";
import { assessProduct } from "../ingredients/assess";
import { matchesFor } from "../ingredients/ledger";
import type { ShelfItem } from "../ingredients/types";
import type { LogStore, Substance, UserProfile } from "../types";
import { daysAgoISO, localISODate, todayISO } from "../../util/dates";
import { BASELINE_DAYS, HORIZON_DAYS } from "./decay";
import type { ShelfAssessment, SignalData } from "./types";

/** How far back the data is loaded: the score's memory, plus the baseline it is compared with, plus eight weeks of history. */
export const HISTORY_WEEKS = 8;
const LOAD_DAYS = HORIZON_DAYS + BASELINE_DAYS + HISTORY_WEEKS * 7 + 1;

export function assessShelf(shelf: ShelfItem[], profile: UserProfile | null, substances: Substance[]): Map<string, ShelfAssessment> {
  const out = new Map<string, ShelfAssessment>();
  for (const it of shelf) {
    const a = assessProduct({ matches: matchesFor(it, substances), unmatchedCount: 0, kind: it.kind, nova: it.nova, frequency: it.frequency, profile, substances });
    out.set(it.id, { id: it.id, name: it.name, kind: it.kind, signal: a.signal, stance: a.stance });
  }
  return out;
}

export function tallyByDay(logs: LogStore, substances: Substance[]): Map<string, DayTally> {
  const days = new Set<string>();
  for (const list of [logs.food, logs.products, logs.environment, logs.air_quality]) for (const e of list) days.add(e.log_date);
  const out = new Map<string, DayTally>();
  for (const day of days) {
    out.set(
      day,
      tallyDay(
        {
          food: logs.food.filter((e) => e.log_date === day),
          products: logs.products.filter((e) => e.log_date === day),
          environment: logs.environment.filter((e) => e.log_date === day),
          air_quality: logs.air_quality.filter((e) => e.log_date === day),
          practices: [],
        },
        substances
      )
    );
  }
  return out;
}

/** The first day anything was recorded, across every kind of record. */
export function firstDay(data: Pick<SignalData, "logs" | "metrics" | "biomarkers" | "checkins" | "learning" | "shelf" | "places">): string | null {
  const days: string[] = [];
  for (const list of [data.logs.food, data.logs.products, data.logs.environment, data.logs.air_quality, data.logs.practices, data.metrics, data.biomarkers, data.checkins]) {
    for (const e of list) days.push(e.log_date);
  }
  for (const e of data.learning) days.push(e.date);
  for (const it of data.shelf) days.push(localISODate(new Date(it.addedAt)));
  for (const p of data.places) for (const answers of Object.values(p.answers)) for (const a of answers) days.push(a.day);
  return days.length ? days.reduce((a, b) => (b < a ? b : a)) : null;
}

/** Reads everything the signals need in one pass, so the score can be evaluated as of any day without touching storage again. */
export async function loadSignalData(now: Date = new Date(), substances: Substance[] = loadHazardDb()): Promise<SignalData> {
  const [logs, metrics, biomarkers, checkins, learning, shelf, places, profile] = await Promise.all([
    db.getLogsForRange(daysAgoISO(LOAD_DAYS, now), todayISO(now)),
    db.getDailyMetrics(1000),
    db.getBiomarkerLogs(1000),
    db.getCheckInLogs(1000),
    db.getLearningEvents(),
    db.getShelfItems(true),
    db.getPlaces(),
    db.getUserProfile(),
  ]);
  const data = { logs, metrics, biomarkers, checkins, learning, shelf, places };
  return {
    ...data,
    shelfAssessments: assessShelf(shelf, profile, substances),
    days: tallyByDay(logs, substances),
    firstActivityDay: firstDay(data),
    substances,
    profile,
  };
}
