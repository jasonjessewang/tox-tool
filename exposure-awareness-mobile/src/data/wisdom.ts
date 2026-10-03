import conceptsData from "./concepts.json";
import type { Concept } from "../engine/types";
import { GUIDELINES } from "./guidelines";

export type WisdomKind = "quote" | "history" | "concept" | "insight" | "guideline";
export type WisdomTier = 1 | 2 | 3;

export interface Wisdom {
  id: string;
  kind: WisdomKind;
  icon: string;
  year?: string;
  text: string;
  attribution?: string;
  /** Familiarity level at which this appears; higher tiers are layered in as literacy grows. */
  tier?: WisdomTier;
}

export const KIND_LABEL: Record<WisdomKind, string> = {
  quote: "A thought to sit with",
  history: "A moment in history",
  concept: "A concept worth knowing",
  insight: "Making sense of risk",
  guideline: "From the guidelines",
};

// Dates and attributions are well-documented historical facts; quotes are the widely
// cited English renderings of the originals.
const CURATED: Wisdom[] = [
  {
    id: "paracelsus_dose",
    kind: "quote",
    icon: "⚖️",
    year: "1538",
    text: "All things are poison, and nothing is without poison; solely the dose determines that a thing is not a poison.",
    attribution: "Paracelsus, founder of modern toxicology",
  },
  {
    id: "carson_nothing_alone",
    kind: "quote",
    icon: "🌿",
    year: "1962",
    text: "In nature nothing exists alone.",
    attribution: "Rachel Carson, Silent Spring",
  },
  {
    id: "snow_broad_street",
    kind: "history",
    icon: "💧",
    year: "1854",
    text: "John Snow mapped a London cholera outbreak to a single water pump. Pattern-spotting in everyday exposures founded modern epidemiology.",
    attribution: "Broad Street, Soho",
  },
  {
    id: "orfila_traite",
    kind: "history",
    icon: "📚",
    year: "1814",
    text: "Mathieu Orfila published a landmark treatise on poisons, turning toxicology into a science built on evidence rather than folklore.",
    attribution: "Traite des poisons",
  },
  {
    id: "fdca_1938",
    kind: "history",
    icon: "📜",
    year: "1938",
    text: "After a toxic solvent in a medicine killed over a hundred people, the U.S. passed the Food, Drug, and Cosmetic Act -- safety testing became the rule.",
    attribution: "Elixir Sulfanilamide, 1937",
  },
  {
    id: "epa_1970",
    kind: "history",
    icon: "🌎",
    year: "1970",
    text: "The U.S. Environmental Protection Agency was established, bringing air, water, and chemical safety under one roof.",
    attribution: "First Earth Day, April 1970",
  },
  {
    id: "ames_1973",
    kind: "history",
    icon: "🧫",
    year: "1973",
    text: "Bruce Ames published a fast bacterial test for chemicals that damage DNA -- a cornerstone of in-silico and in-vitro screening ever since.",
    attribution: "The Ames test",
  },
  {
    id: "lead_gas_1996",
    kind: "history",
    icon: "⛽",
    year: "1996",
    text: "Leaded gasoline was banned for U.S. road vehicles. Average blood lead levels in the population fell dramatically -- proof that removing a source works.",
    attribution: "Clean Air Act phase-out",
  },
  {
    id: "small_steps",
    kind: "quote",
    icon: "🌱",
    text: "You don't need to remove every exposure. You need a few good habits, repeated. Sleep, water, and movement are protective too.",
    attribution: "The idea behind your Journey",
  },
  {
    id: "compound_choices",
    kind: "quote",
    icon: "🧱",
    text: "Small, repeated choices beat one big overhaul. A better breakfast most days matters more than a perfect breakfast once.",
    attribution: "A habit that compounds",
  },
  {
    id: "progress_not_perfect",
    kind: "quote",
    icon: "🎯",
    text: "You don't have to get everything right. Getting slightly more things right, slightly more often, is the whole game.",
    attribution: "Progress over perfection",
  },
  {
    id: "rest_is_progress",
    kind: "quote",
    icon: "😴",
    text: "Rest is not the opposite of progress -- for your body, it's part of how progress happens.",
    attribution: "On recovery",
  },
  {
    id: "shared_exposures",
    kind: "quote",
    icon: "\ud83c\udfe1",
    text: "The people you share a kitchen, a car, or a bedroom with share your exposures too. A change you make for yourself often helps them as well.",
    attribution: "Shared air, shared choices",
  },
  {
    id: "curiosity_not_worry",
    kind: "quote",
    icon: "\ud83e\udded",
    text: "Curiosity keeps this useful. Worry does not. If tracking starts to feel heavy, that's worth noticing too.",
    attribution: "A note on balance",
  },
  // History of cancer and environment, checked against historical reviews on PubMed (Lancet Oncol 2019, PMID 30842048;
  // J UOEH 2021, PMID 34483193) and standard biographies.
  {
    id: "pott_chimney_sweeps",
    kind: "history",
    icon: "\ud83e\uddf9",
    year: "1775",
    text: "Percivall Pott, a London surgeon, traced a cancer common among chimney sweeps to the soot they worked in -- one of the earliest recorded links between a cancer and an everyday working exposure.",
    attribution: "Chimney sweeps' cancer",
  },
  {
    id: "ramazzini_nuns",
    kind: "history",
    icon: "\ud83d\udcdc",
    year: "1713",
    text: "Bernardino Ramazzini, the founder of occupational medicine, noticed breast cancer was more common among nuns -- an early clue that childbearing and breastfeeding shape breast cancer odds, which large studies confirmed centuries later.",
    attribution: "Diseases of Workers",
  },
  {
    id: "carson_silent_spring",
    kind: "history",
    icon: "\ud83d\udcd6",
    year: "1962",
    text: "Rachel Carson finished Silent Spring while being treated for breast cancer. The book changed how people think about the chemicals in everyday life.",
    attribution: "Rachel Carson",
  },
];

const GUIDELINE_ITEMS: Wisdom[] = GUIDELINES.map((g) => ({
  id: `guideline_${g.id}`,
  kind: "guideline" as const,
  tier: 1 as const,
  icon: g.icon,
  year: g.year,
  text: g.text,
  attribution: g.authority,
}));

const CONCEPT_ICONS: Record<string, string> = {
  aggregate_exposure: "🧮",
  bioaccumulation_half_life: "⏳",
  hepatic_metabolism: "🫘",
  renal_clearance: "💧",
  particle_deposition: "🌫️",
  endocrine_disruption: "🧬",
  dose_response: "📈",
  nova_classification: "🍎",
  alpha_radiation: "⚛️",
  adme: "🛤️",
  sensitization: "🔔",
  dispersion: "💨",
  relative_absolute_risk: "🔍",
  confounding: "🧪",
  safety_thresholds: "🧮",
  testing_hierarchy: "🪜",
  causation_criteria: "🧭",
  mixtures: "🌀",
  nutrition_toxicity: "🥕",
  pathway_perturbation: "🔀",
  carcinogen_classification: "🏷️",
  dermal_absorption: "🧴",
  exposome: "🌐",
};

const CONCEPT_TIERS: Record<string, WisdomTier> = {
  aggregate_exposure: 1, dose_response: 1, nova_classification: 1, relative_absolute_risk: 1, hepatic_metabolism: 1, renal_clearance: 1, nutrition_toxicity: 1,
  adme: 2, bioaccumulation_half_life: 2, endocrine_disruption: 2, sensitization: 2, dispersion: 2, particle_deposition: 2, alpha_radiation: 2,
  confounding: 2, safety_thresholds: 2, testing_hierarchy: 2, mixtures: 2,
  carcinogen_classification: 1, dermal_absorption: 1,
  causation_criteria: 3, pathway_perturbation: 3, exposome: 3,
};

const CONCEPT_ITEMS: Wisdom[] = (conceptsData as { concepts: Concept[] }).concepts.map((c) => ({
  tier: CONCEPT_TIERS[c.id] ?? 1,
  id: `concept_${c.id}`,
  kind: "concept" as const,
  icon: CONCEPT_ICONS[c.id] ?? "🔬",
  text: c.general,
  attribution: c.name,
}));

const INSIGHTS: Wisdom[] = [
  { id: "insight_tiny_baseline", kind: "insight", tier: 1, icon: "\ud83d\udd0d", text: "A product that 'raises risk 10 times' turns a 1-in-10,000 chance into 1 in 1,000. Ask for the baseline before the ratio.", attribution: "Relative vs. absolute risk" },
  { id: "insight_hazard", kind: "insight", tier: 1, icon: "\u2696\ufe0f", text: "A hazard is what something can do; risk also needs exposure. Salt and sunlight are both hazards -- amount and duration decide the risk.", attribution: "Hazard vs. risk" },
  { id: "insight_medicine_cabinet", kind: "insight", tier: 1, icon: "\ud83d\udc8a", text: "Acetaminophen is one of the best-tolerated medicines in the world under about 3-4 g a day, and the leading cause of acute liver failure in the US well above it. Same molecule, same rule: the dose makes the poison.", attribution: "Medication is dose-response you already trust" },
  { id: "insight_nutrient_floor", kind: "insight", tier: 1, icon: "\ud83e\udd55", text: "Iron, vitamin A and sodium aren't 'safer in smaller amounts' -- too little causes real harm too. The goal for an essential nutrient is a range, not zero.", attribution: "Essential vs. merely tolerated" },
  { id: "insight_ci", kind: "insight", tier: 2, icon: "\ud83d\udccf", text: "A confidence interval is the range of values the data are consistent with. A wide range means an imprecise estimate, even when the middle number sounds alarming.", attribution: "Reading a statistic" },
  { id: "insight_significant", kind: "insight", tier: 2, icon: "\ud83d\udcca", text: "'Statistically significant' means unlikely to be pure chance. It does not mean the effect is large, or that it matters for your health.", attribution: "Significance vs. importance" },
  { id: "insight_safety_factor", kind: "insight", tier: 2, icon: "\ud83d\udee1\ufe0f", text: "Safety limits typically divide a no-effect dose from animal studies by 100 or more. Being slightly over a limit is a smaller step than it sounds.", attribution: "How thresholds work" },
  { id: "insight_stacking", kind: "insight", tier: 2, icon: "\ud83c\udf00", text: "Combined exposures mostly add up about the way you'd expect from each one alone. True synergy (the mix doing more than the sum) is real but concentrated in specific pairings, mostly at doses well above everyday exposure.", attribution: "How mixtures actually behave" },
  { id: "insight_multiple", kind: "insight", tier: 3, icon: "\ud83c\udfb2", text: "Test 20 unrelated things at a 5% cutoff and about one will look 'significant' by luck. Be wary of the one result reported out of many.", attribution: "Multiple comparisons" },
  { id: "insight_mechanism", kind: "insight", tier: 3, icon: "\ud83e\uddec", text: "A change in gene expression in cells is a clue about mechanism. It is not proof of harm at real-world exposures.", attribution: "Mechanism vs. outcome" },
  { id: "insight_aop_chain", kind: "insight", tier: 3, icon: "\ud83d\udd00", text: "'Binds a receptor' is one link in a chain, not the whole story. The adverse outcome pathway framework names every link from molecular event to health effect -- and asks which ones actually got shown.", attribution: "Tracing the whole pathway" },
  { id: "insight_nams", kind: "insight", tier: 3, icon: "\ud83d\udcbb", text: "Toxicology is combining cell assays, computer models and toxicokinetics to estimate safe doses faster, while still relying on human evidence to confirm.", attribution: "New approach methodologies" },
  // Cancer, cosmetics and the exposome. Each number is from a source read on PubMed or the agency's own page on 2026-10-02
  // (IARC Q&A 2019; CGHFBC Lancet 2001; FDA fragrance and hypoallergenic pages; UK panel Lancet 2012; Miglioretti 2016;
  // Darbre 2004; Islami 2024; Lichtenstein 2000).
  { id: "insight_group_not_size", kind: "insight", tier: 1, icon: "\ud83c\udff7\ufe0f", text: "Tobacco smoking, second-hand smoke and outdoor air pollution all sit in IARC's top cancer group. The group says how sure the evidence is -- smoking still carries a far larger chance of lung cancer than the other two.", attribution: "A group is not a size" },
  { id: "insight_family_history", kind: "insight", tier: 1, icon: "\ud83d\udc6a", text: "Eight in nine women diagnosed with breast cancer have no mother, sister or daughter who had it. That is why screening is offered by age, with family history adding to it rather than replacing it.", attribution: "Family history, in proportion" },
  { id: "insight_unscented", kind: "insight", tier: 1, icon: "\ud83c\udf38", text: "'Unscented' can still contain fragrance: FDA notes some products add just enough to mask other smells. If fragrance is what you're avoiding, the ingredient list is a better guide than the front label.", attribution: "Reading the label" },
  { id: "insight_hypoallergenic", kind: "insight", tier: 1, icon: "\ud83d\udd0e", text: "'Hypoallergenic' has no federal definition in the US. In FDA's words, the term means whatever a particular company wants it to mean.", attribution: "Marketing words vs. defined terms" },
  { id: "insight_overdiagnosis", kind: "insight", tier: 2, icon: "\ud83e\ude7a", text: "In the UK review of breast screening, for every 10,000 women invited from age 50 for 20 years, about 43 breast cancer deaths were prevented and about 129 cancers were found that would otherwise never have come to light. Both numbers belong in the decision.", attribution: "Counting benefits and overdiagnosis" },
  { id: "insight_mammogram_dose", kind: "insight", tier: 2, icon: "\ud83d\udd2c", text: "Modeling estimates that yearly mammograms from 40 to 74 lead to about 125 breast cancers per 100,000 women through radiation, while preventing about 968 breast cancer deaths -- dose-response reasoning, applied to a screening choice.", attribution: "Dose matters in screening too" },
  { id: "insight_detected_not_cause", kind: "insight", tier: 2, icon: "\ud83e\uddeb", text: "Finding a chemical in tissue shows exposure, not cause. A 2004 study measured parabens in 20 breast tumours but had no normal tissue to compare -- and named that comparison as the next question.", attribution: "Detected is not the same as caused" },
  { id: "insight_attributable", kind: "insight", tier: 3, icon: "\ud83d\udc65", text: "'About 40% of cancers are attributable to modifiable factors' is a population estimate. It says where prevention has room across millions of people -- not why any one person's cancer happened.", attribution: "Population numbers, not personal verdicts" },
  { id: "insight_exposome", kind: "insight", tier: 3, icon: "\ud83c\udf0d", text: "Genes are fixed at birth; the exposome -- everything you meet and how your body responds -- changes daily. A study of 44,788 twin pairs found inherited genes play a minor part in most common cancers.", attribution: "Genome and exposome" },
];

// Round-robin so quotes/history, concepts and risk insights alternate instead of clumping.
function interleave(): Wisdom[] {
  const lists = [CURATED, CONCEPT_ITEMS, INSIGHTS, GUIDELINE_ITEMS];
  const out: Wisdom[] = [];
  const max = Math.max(...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

export const WISDOM: Wisdom[] = interleave();

/** Everything at or below a familiarity tier -- harder ideas arrive as literacy grows. */
export function wisdomForTier(tier: WisdomTier): Wisdom[] {
  return WISDOM.filter((w) => (w.tier ?? 1) <= tier);
}

export function wisdomAt(index: number): Wisdom {
  return WISDOM[((index % WISDOM.length) + WISDOM.length) % WISDOM.length];
}

/** One fact per calendar day, stable across visits, cycling through every item. */
export function dailyLearning(date: Date = new Date(), tier: WisdomTier = 3): Wisdom {
  const dayNumber = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  const pool = wisdomForTier(tier);
  return pool[((dayNumber % pool.length) + pool.length) % pool.length];
}

