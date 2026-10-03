/**
 * Toxicology literacy: how far through the curriculum, which tier is unlocked, and what's
 * next. A tier unlocks when at least 80% of the previous tier is done. The end state is
 * independence -- being able to sanity-check a health claim without the app.
 */
import { LESSONS, TIER_INFO, lessonsInTier, type Lesson, type Tier } from "../data/curriculum";
import { MODULE_INFO, MODULE_LESSONS, MODULE_ORDER, lessonsInModule, type ModuleId, type ModuleLesson } from "../data/modules";
import { msg } from "../i18n";

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
    pct === 100 ? msg("You can now sanity-check most health claims on your own.") : pct >= 60 ? msg("You're reading claims like a practitioner.") : pct >= 20 ? msg("You're building the vocabulary.") : msg("Just getting started.");
  return { tier, tiers, doneCount, totalCount: LESSONS.length, pct, next, status };
}

/** An elective lesson opens once every lesson it builds on has been read. */
export function moduleLessonOpen(lesson: ModuleLesson, completed: Set<string>): boolean {
  return lesson.prereqs.every((p) => completed.has(p));
}

export interface ModuleProgress {
  module: ModuleId;
  icon: string;
  title: string;
  blurb: string;
  done: number;
  total: number;
  /** `readFirst`: the lessons it builds on that are still unread; `start`: the one to open now on the way there */
  lessons: { lesson: ModuleLesson; done: boolean; open: boolean; readFirst: Lesson[]; start: Lesson | null }[];
}

/** Each elective module: what has been read, what is open, and for a lesson not yet open, which lessons to read first. */
export function computeModules(completed: Set<string>): ModuleProgress[] {
  const byId = new Map<string, Lesson>([...LESSONS, ...MODULE_LESSONS].map((l) => [l.id, l]));
  return MODULE_ORDER.map((m) => {
    const lessons = lessonsInModule(m).map((lesson) => ({
      lesson,
      done: completed.has(lesson.id),
      open: moduleLessonOpen(lesson, completed),
      readFirst: lesson.prereqs.filter((p) => !completed.has(p)).map((p) => byId.get(p)!),
      start: firstToRead(lesson, completed),
    }));
    return { module: m, ...MODULE_INFO[m], done: lessons.filter((l) => l.done).length, total: lessons.length, lessons };
  });
}

/**
 * For an elective that is not open yet, the first lesson that can be opened right now on the way to it: walking its prerequisites
 * until one is unread and itself open (Foundations always are). Null when the lesson is already open.
 */
export function firstToRead(lesson: ModuleLesson, completed: Set<string>): Lesson | null {
  const coreById = new Map(LESSONS.map((l) => [l.id, l]));
  const moduleById = new Map(MODULE_LESSONS.map((l) => [l.id, l]));
  const seen = new Set<string>();
  const walk = (l: ModuleLesson): Lesson | null => {
    for (const p of l.prereqs) {
      if (completed.has(p) || seen.has(p)) continue;
      seen.add(p);
      const core = coreById.get(p);
      if (core) return core;
      const m = moduleById.get(p)!;
      return moduleLessonOpen(m, completed) ? m : walk(m);
    }
    return null;
  };
  return moduleLessonOpen(lesson, completed) ? null : walk(lesson);
}

/** The next elective worth reading: the first unread one that is open, in module order. */
export function nextModuleLesson(completed: Set<string>): ModuleLesson | null {
  return MODULE_LESSONS.find((l) => !completed.has(l.id) && moduleLessonOpen(l, completed)) ?? null;
}
