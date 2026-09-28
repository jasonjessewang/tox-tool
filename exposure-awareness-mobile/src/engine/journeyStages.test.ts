import { buildJourney, type JourneyContext } from "./journeyStages";
import { STARTER_JOURNEY } from "../data/starterJourney";

const empty: JourneyContext = { starterDone: new Set(), evidenceRead: 0, foodScans: 0, careScans: 0, biomarkers: 0, checkIns: 0, decisions: 0, plantFruits: 0, homeChecks: 0, placesChecked: 0, recallDays: 0 };
const allStarter = new Set(STARTER_JOURNEY.map((q) => q.id));

test("a new user's next step is the first tutorial step (radon, the biggest stone), and later stages are locked", () => {
  const j = buildJourney(empty);
  expect(j.next?.id).toBe("starter_radon");
  expect(j.stages.map((s) => s.unlocked)).toEqual([true, false, false]);
});

test("next step advances through the tutorial in order", () => {
  const j = buildJourney({ ...empty, starterDone: new Set(["starter_radon", "starter_smoke_free"]) });
  expect(j.next?.id).toBe("starter_lead_check");
});

test("finishing the tutorial unlocks Explore and points at its first incomplete step", () => {
  const j = buildJourney({ ...empty, starterDone: allStarter });
  expect(j.stages[0].complete).toBe(true);
  expect(j.stages[1].unlocked).toBe(true);
  expect(j.stages[2].unlocked).toBe(false);
  expect(j.next?.id).toBe("explore_read_research");
});

test("explore steps complete automatically from real activity, in any order", () => {
  const j = buildJourney({ ...empty, starterDone: allStarter, foodScans: 1, biomarkers: 2 });
  const byId = Object.fromEntries(j.stages[1].steps.map((s) => [s.id, s.completed]));
  expect(byId.explore_scan_food).toBe(true);
  expect(byId.explore_biomarker).toBe(true);
  expect(byId.explore_read_research).toBe(false);
  expect(j.next?.id).toBe("explore_read_research");
});

test("mastery unlocks only after every Explore step, and 'scan 10' counts food + care scans", () => {
  const explored = { ...empty, starterDone: allStarter, evidenceRead: 1, foodScans: 6, careScans: 4, biomarkers: 1, checkIns: 3, homeChecks: 3 };
  const j = buildJourney(explored);
  expect(j.stages[1].complete).toBe(true);
  expect(j.stages[2].unlocked).toBe(true);
  expect(j.stages[2].steps.find((s) => s.id === "mastery_scan10")?.completed).toBe(true);
});

test("everything done means no next step", () => {
  const j = buildJourney({ starterDone: allStarter, evidenceRead: 9, foodScans: 8, careScans: 8, biomarkers: 1, checkIns: 9, decisions: 9, plantFruits: 2, homeChecks: 14, placesChecked: 3, recallDays: 3 });
  expect(j.next).toBe(null);
  expect(j.done).toBe(j.total);
});

test("every step has exactly one action and a call-to-action", () => {
  for (const s of buildJourney(empty).stages.flatMap((x) => x.steps)) {
    expect(s.title && s.why && s.action && s.cta && s.ctaLabel).toBeTruthy();
  }
});

test("the places steps complete from real answers: three about home, then three in each kind of place", () => {
  const j = buildJourney({ ...empty, starterDone: allStarter, homeChecks: 3 });
  expect(j.stages[1].steps.find((s) => s.id === "explore_home")?.completed).toBe(true);
  expect(buildJourney({ ...empty, starterDone: allStarter, homeChecks: 2 }).stages[1].steps.find((s) => s.id === "explore_home")?.completed).toBe(false);
  const all = { ...empty, starterDone: allStarter, evidenceRead: 5, foodScans: 6, careScans: 4, biomarkers: 1, checkIns: 3, homeChecks: 8, decisions: 3, plantFruits: 1, recallDays: 3 };
  expect(buildJourney({ ...all, placesChecked: 2 }).next?.id).toBe("mastery_places");
  expect(buildJourney({ ...all, placesChecked: 3 }).next).toBe(null);
  for (const s of buildJourney(empty).stages.flatMap((x) => x.steps).filter((x) => x.id.includes("places") || x.id.endsWith("_home"))) expect(s.cta).toBe("places");
});

test("coming back to what was learned is a mastery step that completes from real recall, on three different days", () => {
  const explored = { ...empty, starterDone: allStarter, evidenceRead: 5, foodScans: 6, careScans: 4, biomarkers: 1, checkIns: 3, homeChecks: 8, decisions: 3, plantFruits: 1, placesChecked: 3 };
  const step = (ctx: JourneyContext) => buildJourney(ctx).stages[2].steps.find((s) => s.id === "mastery_recall")!;
  expect(step({ ...explored, recallDays: 2 }).completed).toBe(false);
  expect(buildJourney({ ...explored, recallDays: 2 }).next?.id).toBe("mastery_recall");
  expect(step({ ...explored, recallDays: 3 }).completed).toBe(true);
  expect(step(explored).cta).toBe("learn");
});

test("mastery asks for decisions, not a streak: three recommendations done or kept, from the Dashboard", () => {
  const explored = { ...empty, starterDone: allStarter, evidenceRead: 5, foodScans: 6, careScans: 4, biomarkers: 1, checkIns: 3, homeChecks: 8, plantFruits: 1, placesChecked: 3, recallDays: 3 };
  const step = (ctx: JourneyContext) => buildJourney(ctx).stages[2].steps.find((s) => s.id === "mastery_decide")!;
  expect(step({ ...explored, decisions: 2 }).completed).toBe(false);
  expect(step({ ...explored, decisions: 3 }).completed).toBe(true);
  expect(step(explored).cta).toBe("dashboard");
  expect(buildJourney(explored).stages.flatMap((x) => x.steps).some((s) => /streak/i.test(s.id + s.title + s.action))).toBe(false);
});
