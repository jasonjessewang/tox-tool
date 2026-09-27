/**
 * Individual risk-stratification, loosely modeled on how real in-silico ADMET/toxicology
 * assessment actually differentiates people -- not a made-up scoring trick. Every
 * amplifier below maps to an established, well-documented pharmacology/toxicology fact:
 *
 *  - Reduced renal/hepatic clearance in kidney/liver disease is the same reasoning
 *    nephrology/hepatology already uses to dose-adjust medications -- a renally-cleared
 *    compound lingers longer if the kidneys clear it more slowly. Same logic, applied to
 *    the substances in hazardDatabase.json that are tagged "renal_clearance" /
 *    "hepatic_metabolism".
 *  - Children have higher intake-per-kg-bodyweight (more air breathed, more food eaten,
 *    relative to body size) and longer remaining lifetime for slow-clearing chemicals to
 *    matter -- the standard EPA rationale for applying extra child-specific uncertainty
 *    factors in reference-dose derivation.
 *  - Reduced renal/hepatic reserve is a well-documented feature of aging (declining GFR,
 *    reduced hepatic blood flow) -- same clearance logic as the kidney/liver conditions,
 *    just age-driven instead of disease-driven.
 *  - Endocrine-disrupting chemical concern is explicitly concentrated around pregnancy in
 *    the literature (developmental windows, placental transfer, lead mobilizing from
 *    maternal bone stores during pregnancy) -- not a general amplification, a specific,
 *    well-established one.
 *
 * This layer is strictly ADDITIVE: it never rewrites engine/scoring.ts's overall_score.
 * A personalized_score is computed alongside it, and the two are always both available,
 * so this can be turned off/compared against the base engine at any time -- the
 * verifiability principle the rest of this engine has held to throughout.
 */
import type { Substance, UserProfile, PersonalReason, LifeStage, Condition, ScoreReport, Category } from "./types";

export function computeLifeStage(ageYears: number | null): LifeStage | null {
  if (ageYears === null || !Number.isFinite(ageYears)) return null;
  if (ageYears < 12) return "child";
  if (ageYears < 18) return "adolescent";
  if (ageYears < 65) return "adult";
  return "older_adult";
}

interface Amplifier {
  conceptTag: string;
  label: string;
  reason: string;
}

const CONDITION_AMPLIFIERS: Record<Condition, Amplifier[]> = {
  kidney: [
    {
      conceptTag: "renal_clearance",
      label: "Kidney condition",
      reason: "Reduced kidney function can slow clearance of chemicals your body normally excretes renally -- similar to why kidney disease often requires adjusting medication doses.",
    },
  ],
  liver: [
    {
      conceptTag: "hepatic_metabolism",
      label: "Liver condition",
      reason: "Reduced liver function can slow the first-pass metabolism most of these compounds rely on to become water-soluble enough to excrete.",
    },
  ],
  asthma: [
    {
      conceptTag: "particle_deposition",
      label: "Asthma / respiratory condition",
      reason: "Airway inflammation from asthma can make particle-triggered irritation more pronounced -- the same reason air-quality advisories specifically call out sensitive respiratory groups.",
    },
  ],
  immunocompromised: [
    {
      conceptTag: "particle_deposition",
      label: "Immunocompromised",
      reason: "Mold/fungal exposure carries meaningfully higher clinical significance in immunocompromised individuals (invasive fungal disease risk) than the general population.",
    },
  ],
  fragrance_sensitivity: [], // handled via direct substance match below, not a concept tag
};

const LIFE_STAGE_AMPLIFIERS: Partial<Record<LifeStage, Amplifier[]>> = {
  child: [
    { conceptTag: "dose_response", label: "Child", reason: "Children take in more air, food, and water per kg of body weight than adults -- the standard reason regulators apply extra child-specific safety margins." },
    { conceptTag: "endocrine_disruption", label: "Child", reason: "Developmental windows in childhood are specifically sensitive periods for endocrine-disrupting chemical exposure." },
    { conceptTag: "particle_deposition", label: "Child", reason: "Higher breathing rate per kg body weight means a higher effective inhaled dose for the same air quality." },
  ],
  adolescent: [
    { conceptTag: "endocrine_disruption", label: "Adolescent", reason: "Puberty is an active developmental/hormonal window, part of why adolescence gets included alongside childhood in developmental-exposure guidance." },
  ],
  older_adult: [
    { conceptTag: "renal_clearance", label: "Age 65+", reason: "Kidney function (GFR) declines gradually with age on average, which can slow clearance of renally-excreted compounds -- the same reasoning behind age-adjusted medication dosing." },
    { conceptTag: "hepatic_metabolism", label: "Age 65+", reason: "Hepatic blood flow and metabolic capacity also tend to decline gradually with age." },
    { conceptTag: "bioaccumulation_half_life", label: "Age 65+", reason: "Slower clearance compounds the effect of any substance that already persists rather than clearing quickly." },
  ],
};

const PREGNANCY_AMPLIFIERS: Amplifier[] = [
  { conceptTag: "endocrine_disruption", label: "Pregnancy", reason: "Endocrine-disrupting chemical concern in the literature is specifically concentrated around pregnancy -- developmental windows and placental transfer are the central mechanism, not a general precaution." },
  { conceptTag: "bioaccumulation_half_life", label: "Pregnancy", reason: "Some persistent compounds (e.g. lead) are known to mobilize from maternal stores (bone, fat) during pregnancy, on top of any new exposure." },
];

const BREASTFEEDING_AMPLIFIERS: Amplifier[] = [
  { conceptTag: "endocrine_disruption", label: "Breastfeeding", reason: "Some endocrine-disrupting and persistent compounds are known to transfer into breast milk." },
  { conceptTag: "bioaccumulation_half_life", label: "Breastfeeding", reason: "Persistent (slow-clearing) compounds a parent has accumulated can transfer via breast milk over the feeding period." },
];

// Fragrance/chemical sensitivity doesn't map to a toxicokinetic concept -- it's a direct
// substance match, not a clearance/dose mechanism, so it's handled separately.
const FRAGRANCE_SENSITIVE_SUBSTANCE_IDS = new Set(["phthalates", "fragranced_laundry_products", "siloxanes"]);

export function getPersonalReasons(substance: Substance, profile: UserProfile): PersonalReason[] {
  const reasons: PersonalReason[] = [];
  const tagSet = new Set(substance.concept_tags);

  for (const condition of profile.conditions) {
    for (const amp of CONDITION_AMPLIFIERS[condition] ?? []) {
      if (tagSet.has(amp.conceptTag)) {
        reasons.push({ conceptTag: amp.conceptTag, label: amp.label, reason: amp.reason });
      }
    }
    if (condition === "fragrance_sensitivity" && FRAGRANCE_SENSITIVE_SUBSTANCE_IDS.has(substance.id)) {
      reasons.push({
        conceptTag: "fragrance_sensitivity",
        label: "Fragrance/chemical sensitivity",
        reason: "You've flagged fragrance/chemical sensitivity, and this is a common trigger source.",
      });
    }
  }

  const lifeStage = computeLifeStage(profile.ageYears);
  if (lifeStage) {
    for (const amp of LIFE_STAGE_AMPLIFIERS[lifeStage] ?? []) {
      if (tagSet.has(amp.conceptTag)) {
        reasons.push({ conceptTag: amp.conceptTag, label: amp.label, reason: amp.reason });
      }
    }
  }

  if (profile.pregnant) {
    for (const amp of PREGNANCY_AMPLIFIERS) {
      if (tagSet.has(amp.conceptTag)) reasons.push({ conceptTag: amp.conceptTag, label: amp.label, reason: amp.reason });
    }
  }
  if (profile.breastfeeding) {
    for (const amp of BREASTFEEDING_AMPLIFIERS) {
      if (tagSet.has(amp.conceptTag)) reasons.push({ conceptTag: amp.conceptTag, label: amp.label, reason: amp.reason });
    }
  }

  // De-dupe by conceptTag+label (a substance could otherwise collect the same reason
  // twice if two profile factors both point at the same concept, e.g. kidney condition
  // AND age 65+ both hitting renal_clearance -- keep both since they're distinct causes,
  // but never literally duplicate the identical entry).
  const seen = new Set<string>();
  return reasons.filter((r) => {
    const key = `${r.conceptTag}:${r.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface PersonalizationResult {
  personalReasonsBySubstance: Record<string, PersonalReason[]>;
  personalizedScore: number;
  profileApplied: boolean;
}

/** Computes personal-relevance annotations for every substance flagged in a report,
 * plus a personalized_score that ADDS to (never replaces) the base overall_score. Capped
 * per-substance so one heavily-tagged substance can't dominate the bump. */
export function personalizeReport(report: ScoreReport, profile: UserProfile | null, substancesById: Record<string, Substance>): PersonalizationResult {
  if (!profile) {
    return { personalReasonsBySubstance: {}, personalizedScore: report.overall_score, profileApplied: false };
  }

  const personalReasonsBySubstance: Record<string, PersonalReason[]> = {};
  let bump = 0;

  for (const cat of Object.values(report.category_summary)) {
    for (const hit of cat?.substances ?? []) {
      const substance = substancesById[hit.id];
      if (!substance) continue;
      const reasons = getPersonalReasons(substance, profile);
      if (reasons.length > 0) {
        personalReasonsBySubstance[hit.id] = reasons;
        bump += Math.min(2, reasons.length);
      }
    }
  }

  return {
    personalReasonsBySubstance,
    personalizedScore: report.overall_score + bump,
    profileApplied: true,
  };
}

/** Educational only -- not an actual dose calculation, since we don't measure mg
 * ingested. Reference doses (RfDs) in real toxicology are expressed per kg body weight,
 * which is the one honestly explainable, non-fabricated connection between body weight
 * and exposure significance available without knowing real intake quantities. */
export function bodyWeightContextNote(weightKg: number | null): string | null {
  if (!weightKg || weightKg <= 0) return null;
  const relative = weightKg < 50 ? "smaller-bodied" : weightKg > 90 ? "larger-bodied" : null;
  if (!relative) {
    return "Toxicology reference doses are set per kg of body weight -- the same intake means a different per-kg dose depending on body size.";
  }
  return `Toxicology reference doses are set per kg of body weight. At ${Math.round(weightKg)}kg, you're on the ${relative} side of typical adult ranges, which is part of why the same intake can matter more or less person to person -- not a reason to change what you eat, just useful context.`;
}
