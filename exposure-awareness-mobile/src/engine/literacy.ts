/**
 * Toxicology literacy: how far through the curriculum, which tier is unlocked, and what's
 * next. A tier unlocks when at least 80% of the previous tier is done. The end state is
 * independence -- being able to sanity-check a health claim without the app.
 */
import { LESSONS, TIER_INFO, lessonsInTier, type Lesson, type Tier } from "../data/curriculum";

export const UNLOCK_FRACTION = 0.8;

export interface TierProgress {
  tier: Tier;
  label: string;
  done: number;
  total: number;
  unlocked: boolean;
}

export interface Literacy {
  tier: Tier; // highest unlocked tier: what loading screens and Daily draw from
  tiers: TierProgress[];
  doneCount: number;
  totalCount: number;
  pct: number;
  next: Lesson | null;
  status: string;
}

export function computeLiteracy(completed: Set<string>): Literacy {
  const tiers: TierProgress[] = ([1, 2, 3] as Tier[]).map((tier, idx, arr) => {
    const lessons = lessonsInTier(tier);
    const done = lessons.filter((l) => completed.has(l.id)).length;
    return { tier, label: TIER_INFO[tier].label, done, total: lessons.length, unlocked: true };
  });
  for (let i = 1; i < tiers.length; i++) {
    const prev = tiers[i - 1];
    tiers[i].unlocked = tiers[i - 1].unlocked && prev.done >= Math.ceil(prev.total * UNLOCK_FRACTION);
  }
  const tier = ([...tiers].reverse().find((t) => t.unlocked)?.tier ?? 1) as Tier;
  const doneCount = LESSONS.filter((l) => completed.has(l.id)).length;
  const next = LESSONS.find((l) => !completed.has(l.id) && tiers[l.tier - 1].unlocked) ?? null;
  const pct = Math.round((doneCount / LESSONS.length) * 100);
  const status =
    pct === 100 ? "You can now sanity-check most health claims on your own." : pct >= 60 ? "You're reading claims like a practitioner." : pct >= 20 ? "You're building the vocabulary." : "Just getting started.";
  return { tier, tiers, doneCount, totalCount: LESSONS.length, pct, next, status };
}
