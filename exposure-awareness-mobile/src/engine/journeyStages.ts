/**
 * The full Journey: Tutorial (starter quests, marked done by hand) -> Explore -> Mastery.
 * Explore and Mastery steps complete AUTOMATICALLY from what the user actually does
 * (reading a research summary, scanning a product...), so there's no honor-system checkbox
 * to game. Stages unlock in order. `next` is always exactly one step -- the single focus.
 */
import { STARTER_JOURNEY } from "../data/starterJourney";
import { msg } from "../i18n";

export type JourneyTarget =
  | "log_food"
  | "log_air"
  | "log_practice"
  | "log_biomarker"
  | "quests"
  | "roadmap"
  | "profile"
  | "evidence"
  | "scan"
  | "shelf"
  | "places"
  | "connections"
  | "daily"
  | "weekly"
  | "dashboard"
  | "learn";

export type StageId = "tutorial" | "explore" | "mastery";

export interface Step {
  id: string;
  stage: StageId;
  title: string;
  why: string;
  action: string;
  cta: JourneyTarget;
  ctaLabel: string;
  manual: boolean; // starter quests are checked off by hand
  completed: boolean;
}

export interface Stage {
  id: StageId;
  title: string;
  blurb: string;
  steps: Step[];
  done: number;
  total: number;
  unlocked: boolean;
  complete: boolean;
}

export interface JourneyContext {
  starterDone: Set<string>;
  evidenceRead: number;
  foodScans: number;
  careScans: number;
  biomarkers: number;
  checkIns: number;
  /** recommendations the person has answered, either done or kept ("I'm keeping this") */
  decisions: number;
  plantFruits: number;
  /** questions answered about the home (any home) */
  homeChecks: number;
  /** kinds of place (home, work, everyday) with at least three questions answered */
  placesChecked: number;
  /** different days on which a question on a lesson was answered (in a lesson, in Daily, or in the review) */
  recallDays: number;
}

interface AutoStepDef {
  id: string;
  stage: "explore" | "mastery";
  title: string;
  why: string;
  action: string;
  cta: JourneyTarget;
  ctaLabel: string;
  check: (c: JourneyContext) => boolean;
}

export const AUTO_STEPS: AutoStepDef[] = [
  { id: "explore_read_research", stage: "explore", title: msg("Read a research summary"), why: msg("These are the papers scientists cite most, boiled down to one page you can actually finish."), action: msg("Open any summary in Research and read the headline and key findings."), cta: "evidence", ctaLabel: msg("Open Research"), check: (c) => c.evidenceRead >= 1 },
  { id: "explore_scan_food", stage: "explore", title: msg("Scan a packaged food you eat often"), why: msg("Seeing an ingredient list you've never read makes the abstract concrete."), action: msg("Scan the barcode (or type the number) on something in your pantry."), cta: "scan", ctaLabel: msg("Scan a food"), check: (c) => c.foodScans >= 1 },
  { id: "explore_scan_care", stage: "explore", title: msg("Scan a shampoo, lotion or cleaner"), why: msg("Personal care products touch your skin daily, often for years."), action: msg("Scan one you use every day and add it to your log."), cta: "scan", ctaLabel: msg("Scan a product"), check: (c) => c.careScans >= 1 },
  { id: "explore_home", stage: "explore", title: msg("Check your home against published guidance"), why: msg("Home is where most of your hours go, so what's in the air and the walls counts the most: radon, damp and how you cook."), action: msg("Answer three plain questions about your home. Each one is compared with EPA guidance."), cta: "places", ctaLabel: msg("Open Places"), check: (c) => c.homeChecks >= 3 },
  { id: "explore_biomarker", stage: "explore", title: msg("Log your first biomarker"), why: msg("One real reading from your own body anchors everything else."), action: msg("Add any number you have: a lab result, resting heart rate, blood pressure."), cta: "log_biomarker", ctaLabel: msg("Log a biomarker"), check: (c) => c.biomarkers >= 1 },
  { id: "explore_checkins", stage: "explore", title: msg("Try the check-in three times"), why: msg("A two-minute look at how the day went, whenever it suits you. Three tries is enough to know whether it helps."), action: msg("Do the check-in under Daily on three different days, any days you like."), cta: "daily", ctaLabel: msg("Go to Daily"), check: (c) => c.checkIns >= 3 },
  { id: "mastery_read5", stage: "mastery", title: msg("Read 5 research summaries"), why: msg("Five papers in, you'll start recognizing patterns in how evidence is built."), action: msg("Keep going in Research -- pick the topics that matter to you."), cta: "evidence", ctaLabel: msg("Open Research"), check: (c) => c.evidenceRead >= 5 },
  { id: "mastery_scan10", stage: "mastery", title: msg("Scan 10 products"), why: msg("A full picture of your pantry and bathroom shelf beats guessing."), action: msg("Scan the things you use most; the engine will flag what's worth knowing."), cta: "scan", ctaLabel: msg("Scan more"), check: (c) => c.foodScans + c.careScans >= 10 },
  { id: "mastery_places", stage: "mastery", title: msg("Look at home, work and the places in between"), why: msg("Exposure follows you through the day. Seeing all three places is what makes advice yours rather than generic."), action: msg("Answer at least three questions for your home, your work or school, and your everyday places."), cta: "places", ctaLabel: msg("Open Places"), check: (c) => c.placesChecked >= 3 },
  { id: "mastery_decide", stage: "mastery", title: msg("Decide on three recommendations"), why: msg("Every suggestion deserves an answer, and \"I'm keeping this\" is one. Deciding is what turns a list into a plan, and it keeps the list short."), action: msg("On the Dashboard, mark three recommendations as done or keep them."), cta: "dashboard", ctaLabel: msg("Open the Dashboard"), check: (c) => c.decisions >= 3 },
  { id: "mastery_recall", stage: "mastery", title: msg("Come back to what you've learned"), why: msg("An idea you recall a few days after reading it is one that stays. A couple of questions on a lesson, spread over days, is how it sticks."), action: msg("Answer a question on a lesson you've read on three different days -- after a lesson, in Daily, or in the review under Learn."), cta: "learn", ctaLabel: msg("Open Learn"), check: (c) => c.recallDays >= 3 },
  { id: "mastery_fruit", stage: "mastery", title: msg("Grow fruit on your plant"), why: msg("Fruit means you're still learning, not just logging."), action: msg("Learn something on two or more days in a week, once your plant is full-grown."), cta: "learn", ctaLabel: msg("Go to Learn"), check: (c) => c.plantFruits >= 1 },
];

const STAGE_META: Record<StageId, { title: string; blurb: string }> = {
  tutorial: { title: msg("Tutorial"), blurb: msg("First steps, biggest sources first.") },
  explore: { title: msg("Explore"), blurb: msg("Go deeper: real research, real products.") },
  mastery: { title: msg("Mastery"), blurb: msg("Make it a lasting practice.") },
};

export function buildJourney(ctx: JourneyContext): { stages: Stage[]; next: Step | null; done: number; total: number } {
  const tutorialSteps: Step[] = [...STARTER_JOURNEY]
    .sort((a, b) => a.order - b.order)
    .map((q) => ({
      id: q.id,
      stage: "tutorial" as const,
      title: q.title,
      why: q.why,
      action: q.action,
      cta: "quests" as const,
      ctaLabel: msg("Show me"),
      manual: true,
      completed: ctx.starterDone.has(q.id),
    }));

  const rawStages: { id: StageId; steps: Step[] }[] = [
    { id: "tutorial", steps: tutorialSteps },
    { id: "explore", steps: AUTO_STEPS.filter((s) => s.stage === "explore").map(toStep(ctx)) },
    { id: "mastery", steps: AUTO_STEPS.filter((s) => s.stage === "mastery").map(toStep(ctx)) },
  ];

  let previousComplete = true;
  const stages: Stage[] = rawStages.map((s) => {
    const done = s.steps.filter((x) => x.completed).length;
    const complete = done === s.steps.length;
    const stage: Stage = { id: s.id, ...STAGE_META[s.id], steps: s.steps, done, total: s.steps.length, unlocked: previousComplete, complete };
    previousComplete = previousComplete && complete;
    return stage;
  });

  const active = stages.find((s) => s.unlocked && !s.complete);
  return {
    stages,
    next: active ? active.steps.find((x) => !x.completed) ?? null : null,
    done: stages.reduce((n, s) => n + s.done, 0),
    total: stages.reduce((n, s) => n + s.total, 0),
  };
}

const toStep = (ctx: JourneyContext) => (d: AutoStepDef): Step => ({
  id: d.id, stage: d.stage, title: d.title, why: d.why, action: d.action, cta: d.cta, ctaLabel: d.ctaLabel, manual: false, completed: d.check(ctx),
});
