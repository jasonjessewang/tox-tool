/**
 * The toxicology-literacy curriculum. Three tiers, unlocked by finishing most of the tier
 * before. Every lesson is one screen with one idea, the misleading pattern to watch for, and
 * a conversation starter -- because most health decisions are made with the people around us.
 * Educational, not medical advice.
 */
export type Tier = 1 | 2 | 3;
export type ToolId = "risk_translator" | "dose_response" | "thresholds" | "evidence_ladder" | "confounding_lab";

export interface Lesson {
  id: string;
  tier: Tier;
  title: string;
  headline: string;
  body: string[];
  watchFor: string;
  talkAbout: string;
  tool?: ToolId;
  evidenceIds?: string[];
}

export const TIER_INFO: Record<Tier, { label: string; blurb: string }> = {
  1: { label: "Foundations", blurb: "The handful of ideas that make headlines readable." },
  2: { label: "Practitioner", blurb: "How evidence is built and how safety limits are set." },
  3: { label: "Advanced", blurb: "Why findings fail, what omics adds, and how causation is judged." },
};

export const TOOL_INFO: Record<ToolId, { icon: string; title: string; blurb: string }> = {
  risk_translator: { icon: "🔍", title: "Risk translator", blurb: "Turn '10x the risk' into real numbers." },
  dose_response: { icon: "📈", title: "Dose-response explorer", blurb: "See why amount decides everything." },
  thresholds: { icon: "🧮", title: "Safety-threshold builder", blurb: "How a 'safe' level is derived." },
  evidence_ladder: { icon: "🪜", title: "Evidence ladder", blurb: "Computer, cells, animals, people." },
  confounding_lab: { icon: "🧪", title: "Confounding lab", blurb: "Watch a scary association disappear." },
};

export const LESSONS: Lesson[] = [
  {
    id: "f_hazard_risk", tier: 1, title: "Hazard is not risk",
    headline: "A hazard is what something can do. Risk is the chance it does -- and that depends on how much reaches you.",
    body: [
      "Salt, sunlight, water and sugar can all cause harm at some dose. What makes something a hazard is its inherent capability; what makes it a risk is exposure.",
      "So a 'known hazard' on a label tells you the start of the question, not the answer. The rest is how much, how often, and for whom.",
    ],
    watchFor: "Headlines that name a hazard ('contains a known carcinogen') but never say how much anyone is actually exposed to.",
    talkAbout: "Pick something in your home with a warning label. What would it take -- in amount and time -- for it to matter?",
  },
  {
    id: "f_dose_response", tier: 1, title: "The dose makes the poison",
    headline: "Almost everything is harmless in a small enough amount and harmful in a large enough one.",
    body: [
      "Paracelsus put it in 1538: 'solely the dose determines that a thing is not a poison.' Toxicology has been measuring that relationship ever since.",
      "The dose-response curve shows how effect changes with amount. Most everyday exposures sit far to the left of where the studies were run.",
    ],
    watchFor: "Claims that treat any exposure as if it behaved like the high dose used in the lab.",
    talkAbout: "Which worry in your household is about the presence of something, rather than the amount?",
    tool: "dose_response",
  },
  {
    id: "f_relative_absolute", tier: 1, title: "'10 times the risk' -- of what?",
    headline: "A relative risk is a ratio. Only the baseline tells you how likely something actually is.",
    body: [
      "If something has a 1-in-10,000 chance and a headline says a product raises it 10 times, the new chance is 1 in 1,000. Real, and still small.",
      "Relative changes sound dramatic because they hide the starting point. Absolute numbers -- 'X out of 1,000 people' -- keep it honest, and researchers who study risk communication have shown that most people, professionals included, misread the relative version.",
    ],
    watchFor: "Any percentage or 'times' without the baseline it applies to. Ask: from what, to what, out of how many?",
    talkAbout: "Next time a health headline uses 'doubles' or 'increases by', work out the absolute numbers together.",
    tool: "risk_translator",
    evidenceIds: ["pmid_26161749"],
  },
  {
    id: "f_exposure_equation", tier: 1, title: "How exposure is estimated",
    headline: "Exposure scientists multiply how much is around by how much you contact it, for how long, per kilogram of body.",
    body: [
      "Intake is roughly concentration x contact rate x duration, divided by body weight (mg per kg per day). It is an estimate, and each term can be measured or improved.",
      "This is why small bodies and daily repeated habits matter: a child eating the same snack every day and an adult using a product once are very different exposures.",
    ],
    watchFor: "One-off measurements presented as though they describe daily life.",
    talkAbout: "Whose routine at home creates the most repeated contact with something -- kids' snacks, a long commute, a shared kitchen?",
  },
  {
    id: "f_association", tier: 1, title: "'Linked to' is not 'causes'",
    headline: "Two things can rise together because a third thing drives both.",
    body: [
      "Ice cream sales and drownings both rise in summer. Neither causes the other -- the weather drives both.",
      "Health studies have the same trap. A finding that two things go together is where the investigation starts, not where it ends.",
    ],
    watchFor: "Language like 'linked to', 'associated with' or 'tied to' being read as 'causes'.",
    talkAbout: "Think of a health claim you've believed. Did it show causing, or just going together?",
  },
  {
    id: "f_exposure_pathways", tier: 1, title: "How it gets in: exposure pathways",
    headline: "The same chemical can be harmless on skin, mild if swallowed, and more serious if inhaled -- route changes everything.",
    body: [
      "A chemical has to get into your body to do anything, and how it gets in -- swallowed, breathed in, or absorbed through skin -- changes how much reaches your bloodstream and how fast. Dust inhaled by a toddler behaves very differently from the same substance briefly touched on unbroken skin.",
      "Toxicologists call the whole trip absorption, distribution, metabolism and excretion (ADME). Oral exposures often pass through the liver first, which can remove a lot before it reaches the rest of the body -- something inhaled bypasses that step entirely.",
    ],
    watchFor: "A safety claim about one route ('safe to touch') stretched to cover a different one ('safe to breathe').",
    talkAbout: "Pick a product you use -- do you touch it, breathe near it, or could it end up on food? Does that change how you'd think about it?",
  },
  {
    id: "f_medication_dose", tier: 1, title: "The medicine cabinet already proves the dose rule",
    headline: "Acetaminophen is one of the best-tolerated common medicines under about 3-4 grams a day, and the leading cause of sudden liver failure well above it.",
    body: [
      "Most people already trust dose-response without calling it that: a normal dose of a medicine helps, and a large enough overdose of the exact same molecule can be dangerous. Acetaminophen (Tylenol) is the clearest everyday example, and one of the best-studied.",
      "A US multicenter study found acetaminophen overdose caused more cases of acute liver failure than any other single identified cause, with a median overdose around 24 grams -- roughly 48 extra-strength tablets. Nearly 4 in 10 of the unintentional cases involved combining two products that both happened to contain acetaminophen, without anyone adding up the total.",
    ],
    watchFor: "Cold, flu and combination pain relievers that list acetaminophen as a second ingredient -- easy to miss while also taking a plain acetaminophen product.",
    talkAbout: "Check one medicine cabinet staple: does it list a maximum daily amount, and would you know if another product you take shares the same ingredient?",
    evidenceIds: ["pmid_16317692"],
  },
  {
    id: "f_nutrition_toxicity", tier: 1, title: "Essential today, toxic tomorrow",
    headline: "Some substances aren't simply safer in smaller amounts -- your body needs a minimum of them, and too little causes real harm too.",
    body: [
      "Iron, vitamin A, sodium and several other nutrients follow a U-shaped pattern: deficiency causes one set of problems, excess causes a different set, and there's a range in between that's the actual target -- not zero.",
      "Nutrition science sets both a floor (a recommended daily intake) and a ceiling (a tolerable upper intake level) for exactly this reason. It's a genuinely different shape than a chemical with no biological role, where less is essentially always the safer direction.",
    ],
    watchFor: "Treating every flagged substance the way 'less is always better' would suggest -- some are toxins to minimize, others are nutrients to get right.",
    talkAbout: "Is there something in your routine -- a supplement, added salt, sun exposure for vitamin D -- where too little worries you as much as too much?",
  },

  {
    id: "p_study_designs", tier: 2, title: "Four ways to test something",
    headline: "Computer models, cells, animals and people each answer a different question.",
    body: [
      "In silico (computer) models predict from structure and existing data. In vitro (cell) tests screen mechanisms quickly. In vivo (animal) studies capture whole-body effects. Human studies show what actually happens in people.",
      "Each has blind spots: models are only as good as their data, cells lack a body, animals aren't people, and human studies are messy. Confidence comes from agreement across all of them.",
    ],
    watchFor: "A single method presented as settled. 'Kills cells in a dish' and 'harms people' are very different claims.",
    talkAbout: "When someone cites a study, ask which of the four it was.",
    tool: "evidence_ladder",
  },
  {
    id: "p_confounding", tier: 2, title: "Confounding: the hidden third factor",
    headline: "A scary association can vanish once you compare like with like.",
    body: [
      "If people who drink more coffee also smoke more, coffee can look harmful when smoking is the cause. Comparing smokers with smokers, and non-smokers with non-smokers, reveals the truth.",
      "Researchers adjust for confounders they thought to measure. The ones nobody measured can still mislead -- one reason observational findings need replication and other kinds of evidence.",
    ],
    watchFor: "'After adjusting for...' is good. Not being told what was adjusted for is a red flag.",
    talkAbout: "What else differs between people who use a product and people who don't?",
    tool: "confounding_lab",
  },
  {
    id: "p_thresholds", tier: 2, title: "Where 'safe' levels come from",
    headline: "Take the highest dose with no observed harm, then divide by safety factors.",
    body: [
      "Regulators start from a no-observed-adverse-effect level (NOAEL) or a benchmark dose, then divide -- commonly by 10 for animal-to-human and 10 for differences between people -- to reach a reference dose.",
      "It is a deliberately protective convention, not a cliff. Being above a limit doesn't mean harm; being below it means a wide margin. The margin of exposure shows how far real exposure sits from the study dose.",
    ],
    watchFor: "Treating a threshold as a sharp line between safe and dangerous.",
    talkAbout: "If a limit has a 100-fold margin built in, what does 'slightly over' really mean?",
    tool: "thresholds",
  },
  {
    id: "p_ci", tier: 2, title: "The range around the number",
    headline: "A study's number is a best guess. The confidence interval shows how far off it could be.",
    body: [
      "In a pooled analysis of home radon, each 100 Bq/m3 raised lung-cancer risk about 8.4%, with a 95% interval of 3.0% to 15.8%. A carotid-plaque study reported a hazard ratio of 4.53 with an interval of 2.00 to 10.27.",
      "The second interval is wide: the data are consistent with a modest effect or a very large one. A narrow interval means a precise estimate. An interval that includes 1.0 (no effect) means the study can't rule out no effect.",
    ],
    watchFor: "Quoting the middle number as if it were certain, and dropping the range.",
    talkAbout: "Next time you see a statistic, look for its range. Does it change how you read it?",
    evidenceIds: ["pmid_15613366", "pmid_38446676"],
  },
  {
    id: "p_aggregate", tier: 2, title: "Your home is a shared exposure",
    headline: "Exposure is a running total across food, air, dust and products -- and much of it is shared with the people you live with.",
    body: [
      "No single item is usually the whole story. The exposome idea is to think about the totality of exposures across a life, not one chemical at a time.",
      "Shared kitchens, shared air and shared routines mean improvements often help everyone at once -- and that different people in the same home (a baby, someone pregnant, someone with a health condition) may be affected differently.",
    ],
    watchFor: "Fixating on one product while ignoring the daily sources that add up.",
    talkAbout: "What is one shared change at home -- ventilation, storage, cooking habits -- that would help everyone?",
    evidenceIds: ["pmid_16103423"],
  },
  {
    id: "p_sensitization", tier: 2, title: "Sensitization: a different kind of threshold",
    headline: "Once the immune system learns to react to something, a much smaller later exposure can trigger a response than the exposure that first caused it.",
    body: [
      "Most toxicology is dose-response: more causes more effect. Sensitization works differently. A first exposure can prime the immune system with no visible symptoms -- then a much smaller later exposure triggers a reaction, as with nickel, some fragrance ingredients, or certain dusts.",
      "This is why patch tests exist, and why someone can use a product for years and then suddenly react to it: the priming already happened quietly. Once sensitized, avoidance -- not a smaller dose -- is the practical response.",
    ],
    watchFor: "Assuming 'I've used this for years with no problem' guarantees it stays that way -- sensitization can develop at any point.",
    talkAbout: "Has anyone in your household developed a new sensitivity to a product they'd used for years without issue?",
  },
  {
    id: "p_mixtures", tier: 2, title: "Exposures don't arrive one at a time",
    headline: "Combined exposures mostly add up close to what you'd expect from each one alone -- true synergy exists but is the exception, not the rule.",
    body: [
      "A meal, a shower routine or a cleaning session brings several flagged substances at once, not one. Combined effects are usually additive -- roughly the sum of each one's own effect -- though occasionally one chemical amplifies another (synergy), most often by interfering with how the body clears it.",
      "Regulators handle this by grouping chemicals that act through the same biological pathway and assuming their doses add together -- a protective default. Documented synergies are real but concentrated in specific pairings, and mostly shown at doses well above everyday exposure.",
    ],
    watchFor: "Either extreme: assuming mixtures are always simply additive, or that any combination could be dangerously synergistic.",
    talkAbout: "Think about your own routine -- which two or three flagged items tend to show up together most often?",
    evidenceIds: ["pmid_28845507"],
  },
  {
    id: "p_swaps_show_up", tier: 2, title: "What changes when you change something?",
    headline: "For many everyday compounds the body clears most of a dose within hours to days, so a swap can show up in your own measurements within a week -- good news, with limits.",
    body: [
      "Several trials have asked people to change one thing -- switch personal care products, eat fresh food instead of canned and plastic-packaged, eat organic -- and then measured the chemicals in their urine. In each, several of the measured compounds fell within days, by roughly a fifth to two-thirds; others did not change.",
      "That speed is the flip side of a short half-life: the body clears phthalates, parabens and BPA quickly, so what you use shows up fast, and a change lasts only as long as the habit does. It also means small experiments are practical -- try one swap for a week and you are testing something the studies already showed can move.",
      "Read these as small before-and-after experiments, not proof of a health benefit. They were short, had no comparison group, measured recent exposure rather than disease, and sometimes a related chemical rose when another was removed. Personal choices matter, and shared measures such as labelling and regulation reach further -- both can be true at once.",
    ],
    watchFor: "Two mistakes: dismissing a change because it is only one source among many, or expecting a swap to be a fix. These studies show that exposure responds; they do not show what the change does for health.",
    talkAbout: "Pick one product or food you could change for a week -- what else in your day would stay the same?",
    evidenceIds: ["pmid_21450549", "pmid_26947464", "pmid_25861095", "pmid_42001662"],
  },

  {
    id: "a_nonmonotonic", tier: 3, title: "When low doses surprise",
    headline: "For some hormone-active chemicals, effects at low doses aren't predicted by high-dose tests.",
    body: [
      "A non-monotonic dose-response is one where the slope changes direction: a low dose can do something a moderate dose doesn't. Reviews have documented such patterns for natural hormones and for some endocrine-disrupting chemicals.",
      "It is debated how often this matters for human health and for regulation, but it explains why high-dose-only testing can miss real effects, especially in early development.",
    ],
    watchFor: "Both extremes: 'any dose is dangerous' and 'high-dose tests always tell the whole story'.",
    talkAbout: "Why might timing -- pregnancy, infancy -- matter as much as amount?",
    tool: "dose_response",
    evidenceIds: ["pmid_22419778"],
  },
  {
    id: "a_multiple", tier: 3, title: "Why many 'findings' don't replicate",
    headline: "Test enough relationships and some will look significant by chance alone.",
    body: [
      "With a 5% significance cutoff, testing 20 unrelated things gives about one 'significant' result by luck. Add small studies, small effects, flexible analyses and strong interests, and a single finding is more likely wrong than right.",
      "This isn't a reason to distrust science. It is a reason to weigh replicated results, large well-designed studies and agreement across different methods above any one striking result.",
    ],
    watchFor: "A single new study on a hot topic, especially one that tested many outcomes and reports the one that worked.",
    talkAbout: "Has the finding been replicated -- and by whom?",
    evidenceIds: ["pmid_16060722"],
  },
  {
    id: "a_causation", tier: 3, title: "Judging causation",
    headline: "Bradford Hill's viewpoints: strength, consistency, timing, dose gradient, plausibility and more.",
    body: [
      "In 1965 Austin Bradford Hill listed considerations for deciding whether an association is likely causal: how strong it is, whether it's consistent across studies, that the cause comes first, that more exposure gives more effect, and whether there's a plausible mechanism.",
      "They are viewpoints for judgment, not a checklist that outputs yes or no. Temporality is the one essential condition. Modern work adds triangulating across study designs that have different biases.",
    ],
    watchFor: "Claims of causation with no dose gradient, no consistency across studies, and no plausible mechanism.",
    talkAbout: "Pick a claim you've heard. Which of the viewpoints does the evidence actually meet?",
    evidenceIds: ["pmid_14283879"],
  },
  {
    id: "a_omics_nams", tier: 3, title: "Omics and new ways to test safety",
    headline: "Measuring thousands of molecules at once, and testing without animals, is changing how thresholds are set.",
    body: [
      "'Omics' methods -- transcriptomics, proteomics, metabolomics and more -- measure many molecules at once in cells or blood to see how the body responds to an exposure. The exposome idea extends this to measuring exposures across a lifetime.",
      "New approach methodologies combine in vitro assays and in silico models, with toxicokinetic modelling to translate a concentration in a dish into a dose in a person. They help prioritize chemicals and estimate points of departure faster than animal studies alone.",
      "A change in gene expression in cells is a clue about mechanism. It is not, by itself, proof of harm at real-world exposures.",
    ],
    watchFor: "'It altered gene expression in cells' presented as if it were a health outcome.",
    talkAbout: "How would you explain the difference between a mechanism and an outcome to a friend?",
    evidenceIds: ["pmid_16103423"],
  },
  {
    id: "a_susceptibility", tier: 3, title: "People aren't average",
    headline: "Timing and individual differences decide who is most affected by the same exposure.",
    body: [
      "Development is a window of susceptibility: exposures during pregnancy and early childhood can matter more than the same exposure later. Age, kidney and liver function, genetics and other conditions also change how the body handles a chemical.",
      "Safety factors are meant to cover variation between people, but averages hide the tails. That is why this app asks about life stage and health conditions, and why extra care around pregnancy and young children is well founded.",
    ],
    watchFor: "Guidance for 'the average adult' applied unchanged to a baby, a pregnancy or someone with a health condition.",
    talkAbout: "Who around you may be more sensitive, and is the home set up with them in mind?",
    evidenceIds: ["pmid_26544531"],
  },
  {
    id: "a_pathway_perturbation", tier: 3, title: "From molecular event to adverse outcome",
    headline: "A chemical binding a receptor is one link in a chain, not the finish line -- mapping the whole chain is what separates a mechanism from a health effect.",
    body: [
      "The adverse outcome pathway (AOP) framework names the whole chain: a molecular initiating event (like a chemical binding a specific receptor), a series of key events at the cell, tissue and organ level, and finally an adverse outcome that matters for health.",
      "Each link can be tested and supported or weakened on its own. A chemical with a well-documented molecular initiating event but no demonstrated downstream key events has a mechanistic hypothesis, not a shown health effect -- exactly the gap the Engine Room tries to make visible instead of collapsing into one alarming sentence.",
    ],
    watchFor: "'Binds a hormone receptor' or 'triggers a pathway' reported as if the chain all the way to a health outcome had already been shown.",
    talkAbout: "Next time you see 'activates pathway X' in a headline, ask how many links of the chain -- from molecule to actual health outcome -- the study covered.",
    evidenceIds: ["pmid_20821501"],
  },
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
export const lessonsInTier = (t: Tier) => LESSONS.filter((l) => l.tier === t);
export const curriculumRef = (id: string) => `curriculum:${id}`;
