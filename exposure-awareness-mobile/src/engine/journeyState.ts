import * as db from "../storage/db";
import * as quests from "./quests";
import * as achievements from "./achievements";
import { getPlant } from "./plantState";
import { buildJourney, type JourneyContext } from "./journeyStages";
import { SCAN_NOTE_PREFIX } from "./scanNotes";
import { countReadings, readPlace } from "./places/evaluate";
import { attemptsFrom } from "./learningChecks";
import { todayISO } from "../util/dates";

export { SCAN_NOTE_PREFIX };

export async function getJourney() {
  const [starter, evidenceRefs, recent, biomarkers, checkins, streak, plant, places, learning] = await Promise.all([
    quests.getStarterJourneyStatus(),
    db.getLearningRefs("evidence:"),
    db.getRecentLogs(1000),
    db.getBiomarkerLogs(1),
    db.getCheckInLogs(60),
    achievements.computeStreak(),
    getPlant(),
    db.getPlaces(),
    db.getLearningEvents(),
  ]);
  const today = todayISO();
  const answered = places.map((p) => ({ kind: p.kind, n: countReadings(readPlace(p, today)).answered }));
  const ctx: JourneyContext = {
    starterDone: new Set(starter.quests.filter((q) => q.completed).map((q) => q.id)),
    evidenceRead: evidenceRefs.length,
    foodScans: recent.food.filter((f) => f.notes.startsWith(SCAN_NOTE_PREFIX)).length,
    careScans: recent.products.filter((p) => p.notes.startsWith(SCAN_NOTE_PREFIX)).length,
    biomarkers: biomarkers.length,
    checkIns: new Set(checkins.map((c) => c.log_date)).size,
    streak,
    plantFruits: plant.plant.fruits,
    homeChecks: answered.filter((a) => a.kind === "home").reduce((s, a) => s + a.n, 0),
    placesChecked: new Set(answered.filter((a) => a.n >= 3).map((a) => a.kind)).size,
    recallDays: new Set(attemptsFrom(learning).map((a) => a.day)).size,
  };
  return { ...buildJourney(ctx), plant: plant.plant };
}
