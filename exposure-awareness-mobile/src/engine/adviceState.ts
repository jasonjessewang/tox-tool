import * as db from "../storage/db";
import { buildLedger, standingFromLedger } from "./ingredients/ledger";
import { getPlacesStanding } from "./places/state";
import { daysAgoISO, todayISO } from "../util/dates";
import type { AdviceInputs, StandingExposure } from "./types";

/** How long "I'm keeping this" holds Focus and Quick Wins quiet about something. */
export const KEEP_DAYS = 60;

/**
 * The exposure the shelf carries week after week, ready to hand to scoreLogs. Recomputed from the
 * stored ingredient text on every call, like the ledger itself, so a database improvement applies
 * to advice immediately.
 */
export async function getStandingExposure(now: Date = new Date()): Promise<StandingExposure[]> {
  return standingFromLedger(buildLedger(await db.getShelfItems(true), now));
}

/**
 * One substance can stand on the shelf and in a place at once (a fragranced shampoo, a scented home): the two are one
 * decision, so their weights add and the advice remembers where each comes from.
 */
export function mergeStanding(...lists: StandingExposure[][]): StandingExposure[] {
  const by = new Map<string, StandingExposure>();
  for (const st of lists.flat()) {
    const cur = by.get(st.substanceId);
    if (!cur) {
      by.set(st.substanceId, { ...st, via: [...st.via], viaPlaces: [...(st.viaPlaces ?? [])], origin: st.origin ?? "shelf" });
      continue;
    }
    const dominant = st.weight > cur.weight ? st.origin ?? "shelf" : cur.origin ?? "shelf";
    by.set(st.substanceId, { substanceId: st.substanceId, weight: cur.weight + st.weight, via: [...cur.via, ...st.via], viaPlaces: [...(cur.viaPlaces ?? []), ...(st.viaPlaces ?? [])], origin: dominant });
  }
  return [...by.values()];
}

/** Everything scoreLogs needs beyond the logs: what the shelf and the places carry, and what the person has decided to leave alone. */
export async function getAdviceInputs(now: Date = new Date()): Promise<Required<AdviceInputs>> {
  const [shelf, places, kept] = await Promise.all([getStandingExposure(now), getPlacesStanding(now), db.getKeptAdvice(todayISO(now))]);
  return { standing: mergeStanding(shelf, places), kept: new Set(kept.map((k) => k.source_key)) };
}

/** Records the decision to leave something as it is. It comes back after KEEP_DAYS, or sooner if the person undoes it. */
export async function keepAdvice(sourceKey: string, label: string, now: Date = new Date()): Promise<void> {
  await db.keepAdvice({ source_key: sourceKey, label, decided_date: todayISO(now), until: daysAgoISO(-KEEP_DAYS, now) });
}
