/**
 * The Starter Journey is a plain checklist: done or not yet, counted as steps (no points).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getStarterJourneyStatus, completeStarterQuest } from "./quests";
import { STARTER_JOURNEY } from "../data/starterJourney";

beforeEach(async () => {
  await AsyncStorage.clear();
});

test("nothing done: every step open, counted as steps", async () => {
  const s = await getStarterJourneyStatus();
  expect(s.done).toBe(0);
  expect(s.total).toBe(STARTER_JOURNEY.length);
  expect(s.quests.every((q) => !q.completed)).toBe(true);
});

test("completing a step marks it done once, however many times it is ticked", async () => {
  await completeStarterQuest("starter_radon");
  await completeStarterQuest("starter_radon");
  const s = await getStarterJourneyStatus();
  expect(s.done).toBe(1);
  expect(s.quests.find((q) => q.id === "starter_radon")!.completed).toBe(true);
});

test("an unknown id changes nothing", async () => {
  await completeStarterQuest("not_a_step");
  expect((await getStarterJourneyStatus()).done).toBe(0);
});

test("no step title or id references score or risk vocabulary", () => {
  for (const q of STARTER_JOURNEY) {
    const text = (q.id + " " + q.title).toLowerCase();
    for (const forbidden of ["score", "risk", "concern", "band"]) expect(text.includes(forbidden)).toBe(false);
  }
});
