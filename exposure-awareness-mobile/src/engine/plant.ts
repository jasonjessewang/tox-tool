/**
 * The growth companion. Pure: growth comes from the first steps the person has actually done, and fruit from
 * learning once it is full-grown.
 *
 *  - Stage (seed -> mature) tracks Starter Journey completion only; it never regresses.
 *  - Calm by design (engine/calm.ts): the plant never goes thirsty or wilts when the app is closed for a while, and it
 *    has no needs to nag about. Time away is not a failure. (The "thirsty" and "wilting" values stay in the type only so
 *    older stored states and the drawing code keep compiling; computePlant never returns them.)
 *  - Fruit appears on a full-grown plant in a week with learning on two or more days.
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

  const health: PlantHealth = "thriving";
  const fruits = mature && i.learningDaysLast7 >= 2 ? Math.min(3, i.learningDaysLast7 - 1) : 0;
  const needs: PlantNeed[] = [];

  let message: string;
  if (mature && fruits > 0) message = `Full-grown and fruiting -- ${fruits} fruit${fruits > 1 ? "s" : ""} from your recent learning.`;
  else if (mature) message = "Full-grown. It bears fruit in a week when you learn something new on two or more days.";
  else if (stage === "seed") message = "A seed, waiting. It sprouts when you finish your first step.";
  else message = `Growing -- ${i.starterDone} of ${i.starterTotal} first steps done.`;

  return { stage, stageLabel: STAGE_LABELS[stage], health, fruits, needs, message, starterDone: i.starterDone, starterTotal: i.starterTotal };
}
