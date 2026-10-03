/**
 * Turns a matched ingredient list into a plain-language stance for one product.
 *
 * NOT a toxicity verdict. The signal combines (a) how consistently each matched substance is
 * flagged in public-health guidance (the database's concern level), (b) where it sits on the
 * label (a main ingredient vs a trace one), (c) ultra-processing for food, (d) what the
 * profile says about who's using it, and (e) how often it's used. Amounts are unknown; the
 * output says so.
 */
import { loadHazardDb } from "../scoring";
import { getPersonalReasons } from "../personalization";
import type { Substance, UserProfile, PersonalReason } from "../types";
import type { MatchedSubstance } from "./match";
import { FREQUENCY_INFO, type Frequency, type ProductKind } from "./types";
import { msg, tr, trn } from "../../i18n";

export type Stance = "everyday_ok" | "moderation" | "consider_swap";

export interface Reason {
  substanceId: string;
  name: string;
  line: string;
  /** the same line with the plain-language summary, for the "Simple" detail level */
  linePlain: string;
  weight: number;
}

/** A matched substance that's a documented "regrettable substitute" -- a close chemical
 * relative of something more famous/restricted, often used specifically because it isn't
 * (yet) as scrutinized, with research generally finding comparable rather than reduced
 * concern. Surfaced separately from `reasons` so the UI can call out the specific "this
 * reads as X-free but contains a relative of X" pattern rather than burying it in a
 * generic ingredient list. */
export interface SubstitutionNote {
  substanceId: string;
  substanceName: string;
  relatedId: string;
  relatedName: string;
}

export interface Assessment {
  stance: Stance;
  headline: string;
  signal: number;
  reasons: Reason[];
  suggestions: string[];
  caveats: string[];
  personal: { substance: string; reasons: PersonalReason[] }[];
  substitutions: SubstitutionNote[];
}

const TIER_WEIGHT = { major: 1, minor: 0.5, trace: 0.2 } as const;
const TIER_TEXT = { major: msg("a main ingredient"), minor: msg("a smaller ingredient"), trace: msg("listed near the end (small amount)") } as const;
const CONCERN_TEXT: Record<number, string> = { 1: msg("lightly flagged"), 2: msg("moderately flagged"), 3: msg("consistently flagged") };

/** Where a product's frequency-adjusted signal crosses from one stance to the next. Shared with the score, which
 *  compares every shelf product against these same reference rules. */
export const STANCE_THRESHOLDS = { moderation: 1.2, swap: 3.5 } as const;

export const STANCE_INFO: Record<Stance, { headline: string; color: "accent" | "warn" | "danger" }> = {
  everyday_ok: { headline: msg("Reasonable as an everyday item"), color: "accent" },
  moderation: { headline: msg("Fine in moderation -- mind how often"), color: "warn" },
  consider_swap: { headline: msg("Worth swapping when it's convenient"), color: "danger" },
};

// a sentence ends at . ! ? and a space, or at the full-width 。！？ that Chinese and Japanese use without one
const firstSentence = (s: string) => (s.split(/(?<=[.!?])\s|(?<=[。！？])/)[0] ?? s).trim();

export function assessProduct(input: {
  matches: MatchedSubstance[];
  unmatchedCount: number;
  kind: ProductKind;
  nova: 1 | 2 | 3 | 4 | null;
  frequency: Frequency;
  profile: UserProfile | null;
  substances?: Substance[];
}): Assessment {
  const substances = input.substances ?? loadHazardDb();
  const byId = new Map(substances.map((s) => [s.id, s]));

  const reasons: Reason[] = input.matches.map((m) => {
    const weight = m.concernLevel * TIER_WEIGHT[m.tier] * (m.confidence === "possible" ? 0.6 : 1);
    const s = byId.get(m.substanceId);
    const how = m.confidence === "possible" ? tr("\"{ingredient}\" is listed, but the label doesn't say what's in it", { ingredient: m.ingredient }) : tr("{tier} (\"{ingredient}\")", { tier: tr(TIER_TEXT[m.tier]), ingredient: m.ingredient });
    const lead = tr("{concern}; {how}.", { concern: tr(CONCERN_TEXT[m.concernLevel] ?? msg("flagged")), how });
    return {
      substanceId: m.substanceId,
      name: m.name,
      weight,
      line: `${lead} ${s ? firstSentence(tr(s.summary)) : ""}`.trim(),
      linePlain: `${lead} ${s ? firstSentence(tr(s.summary_plain ?? s.summary)) : ""}`.trim(),
    };
  });
  reasons.sort((a, b) => b.weight - a.weight);

  let signal = reasons.reduce((sum, r) => sum + r.weight, 0);
  if (input.kind === "food" && input.nova === 4) {
    signal += 1;
    const nova4 = msg("Ultra-processed food (NOVA 4): a formulation with many industrial ingredients. The concern is the overall pattern, not a single ingredient.");
    reasons.push({ substanceId: "nova4", name: msg("Ultra-processed"), weight: 1, line: nova4, linePlain: nova4 });
  }

  const personal: Assessment["personal"] = [];
  if (input.profile) {
    for (const m of input.matches) {
      const s = byId.get(m.substanceId);
      const r = s ? getPersonalReasons(s, input.profile) : [];
      if (r.length) personal.push({ substance: m.name, reasons: r });
    }
    signal += Math.min(2, personal.length * 0.75);
  }

  signal *= FREQUENCY_INFO[input.frequency].factor;
  const stance: Stance = signal < STANCE_THRESHOLDS.moderation ? "everyday_ok" : signal < STANCE_THRESHOLDS.swap ? "moderation" : "consider_swap";

  const seen = new Set<string>();
  const suggestions: string[] = [];
  for (const r of reasons) {
    for (const tip of byId.get(r.substanceId)?.mitigation_tips ?? []) {
      if (!seen.has(tip) && suggestions.length < 3) {
        seen.add(tip);
        suggestions.push(tip);
      }
    }
  }
  if (input.kind === "food" && input.nova === 4) suggestions.push(msg("A minimally processed alternative (e.g. whole-food versions) trims many additives at once."));

  const caveats = [tr("Based on ingredient names and their order on the label (most abundant first). It cannot know actual amounts.")];
  if (input.unmatchedCount > 0) caveats.push(trn(input.unmatchedCount, "{n} other ingredient isn't in our database -- that's not the same as being safe.", "{n} other ingredients aren't in our database -- that's not the same as being safe."));
  if (input.matches.length === 0) caveats.push(tr("Nothing was flagged, but we can only recognize what's in our database."));
  caveats.push(tr("Education, not medical advice."));

  // "Regrettable substitution": a matched ingredient is a documented close relative of a
  // more well-known substance (e.g. bisphenol S standing in for BPA). The substitute's own
  // concern_level already feeds `signal` like any other match -- this is purely the
  // explanatory link, so the UI can say *why* it's relevant even to someone who only
  // recognizes the more famous name.
  const substitutions: SubstitutionNote[] = [];
  for (const m of input.matches) {
    const s = byId.get(m.substanceId);
    for (const relatedId of s?.regrettable_substitute_for ?? []) {
      const related = byId.get(relatedId);
      substitutions.push({ substanceId: m.substanceId, substanceName: m.name, relatedId, relatedName: related?.name ?? relatedId });
    }
  }

  return {
    stance,
    headline: input.matches.length === 0 && stance === "everyday_ok" ? msg("Nothing in our database flagged") : STANCE_INFO[stance].headline,
    signal: Math.round(signal * 100) / 100,
    reasons,
    suggestions,
    caveats,
    personal,
    substitutions,
  };
}
