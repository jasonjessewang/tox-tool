/**
 * The growth companion. Pure: growth comes from the starter journey, health from how
 * recently you cared for it, and fruit only from ongoing learning once mature.
 *
 *  - Stage (seed -> mature) tracks starter-quest completion only; it never regresses.
 *  - Health reflects recency of any care (a log, check-in, action, or learning): thriving
 *    within 2 days, thirsty at 3-4, wilting at 5+.
 *  - A mature plant that hasn't learned anything in 7 days is "thirsty" no matter how much
 *    else you log -- learning is what keeps it fruiting.
 *  - Never fear-based: a wilting plant recovers the moment you do anything.
 */
export type PlantStage = "seed" | "sprout" | "seedling" | "sapling" | "mature";
export type PlantHealth = "thriving" | "thirsty" | "wilting";
export type PlantNeed = "water" | "learn" | "checkin";

export interface PlantInputs {
  starterDone: number;
  starterTotal: number;
  daysSinceCare: number | null;
  learningDaysLast7: number;
  checkInDaysLast7: number;
}

export interface PlantState {
  stage: PlantStage;
  stageLabel: string;
  health: PlantHealth;
  fruits: number;
  needs: PlantNeed[];
  message: string;
  starterDone: number;
  starterTotal: number;
}

export const STAGE_LABELS: Record<PlantStage, string> = {
  seed: "Seed",
  sprout: "Sprout",
  seedling: "Seedling",
  sapling: "Sapling",
  mature: "Full-grown",
};

export function stageFor(done: number, total: number): PlantStage {
  if (done <= 0) return "seed";
  const frac = done / Math.max(1, total);
  if (frac >= 1) return "mature";
  if (frac < 0.3) return "sprout";
  if (frac < 0.66) return "seedling";
  return "sapling";
}

export function computePlant(i: PlantInputs): PlantState {
  const stage = stageFor(i.starterDone, i.starterTotal);
  const mature = stage === "mature";

  let health: PlantHealth;
  if (i.daysSinceCare === null) health = stage === "seed" ? "thriving" : "thirsty";
  else if (i.daysSinceCare <= 2) health = "thriving";
  else if (i.daysSinceCare <= 4) health = "thirsty";
  else health = "wilting";

  if (mature && i.learningDaysLast7 === 0 && health === "thriving") health = "thirsty";

  const fruits = mature && health === "thriving" && i.learningDaysLast7 >= 2 ? Math.min(3, i.learningDaysLast7 - 1) : 0;

  const needs: PlantNeed[] = [];
  if (health !== "thriving" && (i.daysSinceCare === null || i.daysSinceCare >= 3)) needs.push("water");
  if (stage !== "seed" && i.learningDaysLast7 < (mature ? 2 : 1)) needs.push("learn");
  if (i.checkInDaysLast7 === 0 && stage !== "seed") needs.push("checkin");

  let message: string;
  if (health === "wilting") message = "Your plant is dry. Any log, check-in or lesson gives it water.";
  else if (mature && fruits > 0) message = `Full-grown and fruiting -- ${fruits} fruit${fruits > 1 ? "s" : ""} from your recent learning.`;
  else if (mature && needs.includes("learn")) message = "Full-grown, but it needs fresh learning to bear fruit. Read a topic or listen to a lesson.";
  else if (mature) message = "Full-grown and healthy. One or two more learning days this week will bring fruit.";
  else if (health === "thirsty") message = "Getting thirsty -- log something small today.";
  else if (stage === "seed") message = "A seed, waiting. Finish your first starter quest to sprout it.";
  else message = `Growing steadily -- ${i.starterDone} of ${i.starterTotal} starter quests done.`;

  return { stage, stageLabel: STAGE_LABELS[stage], health, fruits, needs, message, starterDone: i.starterDone, starterTotal: i.starterTotal };
}
