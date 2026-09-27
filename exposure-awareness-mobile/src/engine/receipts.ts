/**
 * The comparison receipt: every recorded activity answers "how does this compare?".
 *
 * An activity is recorded through runActivity(kind, write). The score is read before and after, and the receipt is
 * the difference, told for the parts of the picture that activity feeds (registry.ts): what changed, what it was
 * compared with, and how much better the picture is seen. Because the receipt is derived from the same signals as the
 * score, any new activity or signal gets one automatically -- there is no per-screen analysis to forget to write.
 * An activity that deliberately is not scored (a decision, a setting) says why instead.
 */
import { ACTIVITY_ROLE, signalsFedBy } from "./signals/registry";
import type { ActivityKind, ComparisonPart, SignalKey } from "./signals/types";
import { getWellnessScore } from "./wellnessState";
import { recordAutoQuestCompletions } from "./quests";
import type { ScoreComponent, WellnessScore } from "./wellnessScore";

export interface ReceiptLine {
  key: SignalKey;
  label: string;
  before: { value: number; confidence: number };
  after: { value: number; confidence: number };
  /** the comparisons as they read after the activity */
  parts: ComparisonPart[];
  /** the change in words */
  headline: string;
  vsBefore: ScoreComponent["vsBefore"];
}

export interface Receipt {
  kind: ActivityKind;
  headline: string;
  score: { before: number; after: number; coverageBefore: number; coverageAfter: number; provisional: boolean };
  lines: ReceiptLine[];
  /** set when the activity deliberately does not move the score: why */
  unscored: string | null;
  notes: string[];
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const r0 = (n: number) => Math.round(n);

function describeLine(before: ScoreComponent, after: ScoreComponent): string {
  const label = after.label;
  const means = after.valueMeans ? ` (${after.valueMeans})` : "";
  // A first reading rests on very little; say so in the same breath, so the number is not taken for a verdict on a breakfast.
  if (before.confidence === 0 && after.confidence > 0) return `${label}: a first reading -- ${r0(after.value)} out of 100${means}${after.confidence < 0.5 ? ", from very little so far, so it will settle as more comes in" : ""}.`;
  if (after.confidence === 0) return `${label}: nothing to read yet.`;
  const delta = after.value - before.value;
  if (Math.abs(delta) >= 1) return `${label}: ${r0(before.value)} -> ${r0(after.value)} out of 100${means}.`;
  if (after.confidence - before.confidence >= 0.02) return `${label}: about the same (${r0(after.value)}), and the app can see it better now (${pct(before.confidence)} -> ${pct(after.confidence)}).`;
  return `${label}: no change.`;
}

export function buildReceipt(kind: ActivityKind, before: WellnessScore, after: WellnessScore, extraNotes: string[] = []): Receipt {
  const role = ACTIVITY_ROLE[kind];
  const fed = signalsFedBy(kind);

  const lines: ReceiptLine[] = fed.map((key) => {
    const b = before.components.find((c) => c.key === key)!;
    const a = after.components.find((c) => c.key === key)!;
    return { key, label: a.label, before: { value: b.value, confidence: b.confidence }, after: { value: a.value, confidence: a.confidence }, parts: a.parts, headline: describeLine(b, a), vsBefore: a.vsBefore };
  });

  const moved = after.overall - before.overall;
  const fuller = after.coverage - before.coverage;
  const unscored = "unscored" in role ? role.unscored : null;
  let headline: string;
  if (unscored) headline = "Saved. This one doesn't move your score directly.";
  else if (after.provisional) headline = `Saved. Your picture is ${after.coverage}% filled in so far -- this is an early reading.`;
  else if (moved !== 0) headline = `Your score went from ${before.overall} to ${after.overall}.`;
  else if (fuller >= 1) headline = `Your score stays at ${after.overall}, and the picture is a little fuller (${before.coverage}% -> ${after.coverage}%).`;
  else headline = `Saved. Your score stays at ${after.overall}.`;

  const notes = [...lines.flatMap((l) => after.components.find((c) => c.key === l.key)!.notes.slice(0, 2)), ...extraNotes];
  return { kind, headline, score: { before: before.overall, after: after.overall, coverageBefore: before.coverage, coverageAfter: after.coverage, provisional: after.provisional }, lines, unscored, notes };
}

/**
 * Records an activity and returns its comparison receipt. `write` does the actual storage writes (as many as the screen
 * needs); the score is read once before and once after, so the receipt reflects everything the activity changed.
 */
export async function runActivity<T>(kind: ActivityKind, write: () => Promise<T>, opts: { now?: Date; notes?: string[] } = {}): Promise<{ result: T; receipt: Receipt }> {
  const before = await getWellnessScore(undefined, opts.now);
  const result = await write();
  try {
    await recordAutoQuestCompletions(); // doing the thing earns the quest's XP at the moment it is done
  } catch {
    // crediting XP never gets in the way of recording the activity
  }
  const after = await getWellnessScore(undefined, opts.now);
  return { result, receipt: buildReceipt(kind, before, after, opts.notes ?? []) };
}
