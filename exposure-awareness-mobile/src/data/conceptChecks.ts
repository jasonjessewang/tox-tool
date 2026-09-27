/**
 * Concept checks: two short questions on every lesson in the curriculum, for recalling an idea rather than re-reading it.
 *
 * Every question is built from the lesson's own text -- nothing here introduces a fact the lesson does not state -- and asks
 * the person to APPLY the idea (a headline, a label, a study summary) more than to repeat a definition. A wrong answer is never a
 * failure: it shows the explanation and brings the question back sooner (see engine/learningChecks.ts).
 *
 * The correct answer is placed by a fixed rule (see `place`), not by hand, so it does not always sit in the same position.
 */
export interface ConceptCheck {
  id: string;
  lessonId: string;
  prompt: string;
  options: string[];
  /** index of the correct option in `options` */
  answer: number;
  explain: string;
}

/** A small, stable hash so the correct answer's position varies from question to question but never changes for a given one. */
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function q(lessonId: string, n: 1 | 2, prompt: string, correct: string, wrong: string[], explain: string): ConceptCheck {
  const id = `${lessonId}.${n}`;
  const at = hash(id) % (wrong.length + 1);
  const options = [...wrong.slice(0, at), correct, ...wrong.slice(at)];
  return { id, lessonId, prompt, options, answer: at, explain };
}

export const CONCEPT_CHECKS: ConceptCheck[] = [
  // ---------------------------------------------------------------- Foundations
  q("f_hazard_risk", 1, "A label says a product contains \"a known carcinogen.\" What else do you need to know to judge how much that matters?",
    "How much of it reaches you, how often, and who is exposed",
    ["Nothing more -- a warning on the label already tells you the chance of harm", "Whether the manufacturer is a large company with a good safety record", "Whether the ingredient's chemical name is long or hard to pronounce"],
    "A hazard is what something can do; risk is the chance it does, and that depends on how much reaches you. A warning is where the question starts."),
  q("f_hazard_risk", 2, "Which of these is a statement about risk, not only about hazard?",
    "\"At your typical intake, the estimated dose is far below the level that caused effects in studies.\"",
    ["\"This chemical has been shown to damage the liver when very large doses were given to laboratory animals.\"", "\"This chemical appears on a regulatory list of substances of concern for human health.\"", "\"This chemical is man-made rather than natural, and is widely used in industrial processes.\""],
    "Risk brings exposure into it: how much actually reaches you compared with what was needed to see an effect. The other three only describe what a substance can do or how it is classed."),

  q("f_dose_response", 1, "Paracelsus's point, in 1538, was that...",
    "Whether something is a poison depends on the dose",
    ["Natural substances are safe at any amount, unlike man-made ones", "Only the largest animals are affected by chemical exposures", "Anything a laboratory can measure is harmful to people"],
    "Almost everything is harmless in a small enough amount and harmful in a large enough one. Toxicology has been measuring that relationship ever since."),
  q("f_dose_response", 2, "A lab study finds harm at a very high dose. What is the most careful reading for an everyday exposure?",
    "Everyday exposures usually sit far below the studied dose, so how the amounts compare is the next question",
    ["The everyday exposure must be harmful too, since the same substance was shown to cause harm", "The study can be set aside, because laboratory doses never say anything about real life", "Everyday exposure is always zero, so there is nothing to compare with the study"],
    "Most everyday exposures sit far to the left of where studies were run. The pattern to watch for is treating any exposure as if it behaved like the high dose used in the lab."),

  q("f_relative_absolute", 1, "Something has a 1-in-10,000 chance, and a headline says a product raises it 10 times. What is the new chance?",
    "1 in 1,000",
    ["1 in 100,000", "1 in 100", "1 in 10"],
    "Ten times 1 in 10,000 is 1 in 1,000: real, and still small. A relative risk is a ratio; only the baseline tells you how likely something actually is."),
  q("f_relative_absolute", 2, "Why do relative changes (\"doubles the risk\") sound more dramatic than absolute ones?",
    "They leave out the starting point",
    ["They are always calculated incorrectly", "They apply to much larger groups of people", "The law requires them to sound stronger"],
    "A relative risk is a ratio; only the baseline tells you how likely something actually is. Asking \"from what, to what, out of how many?\" keeps it honest."),

  q("f_exposure_equation", 1, "Roughly how do exposure scientists estimate intake?",
    "Concentration x contact rate x duration, divided by body weight",
    ["Concentration plus the number of years a product has been on the market", "The concentration alone, since that is the only thing that can be measured", "The number of ingredients listed on the label multiplied by the price"],
    "Intake is an estimate built from those terms, and each one can be measured or improved. It is expressed per kilogram of body weight."),
  q("f_exposure_equation", 2, "Why can a child eating the same snack every day have a very different exposure from an adult using a product once?",
    "Daily repetition and a smaller body both raise the amount per kilogram",
    ["Children absorb every chemical completely, and adults absorb none of it", "Snacks are regulated more loosely than the products adults use once", "Adults clear every chemical within minutes, while children never do"],
    "Small bodies and repeated daily habits matter: the same contact, more often and spread over less body weight, adds up to a larger dose per kilogram."),

  q("f_association", 1, "Ice cream sales and drownings both rise in summer. What is the best explanation?",
    "A third factor -- warm weather -- drives both",
    ["Eating ice cream makes swimmers tired enough to drown", "Drownings make more people want to buy ice cream", "It is pure coincidence with no explanation at all"],
    "Neither causes the other; the weather drives both. Health studies have the same trap."),
  q("f_association", 2, "A study reports that a chemical is \"linked to\" a health condition. The most accurate way to read that is...",
    "The two go together in the data, which is where the investigation starts",
    ["The chemical causes the condition, and the study has shown it", "The condition causes people to be exposed to the chemical", "The study must be flawed, because associations are never real"],
    "\"Linked to\" and \"associated with\" describe things that go together. Whether one causes the other is a separate question."),

  q("f_exposure_pathways", 1, "Why can the same chemical be harmless on the skin, but more serious if breathed in?",
    "The route changes how much reaches the bloodstream and how fast",
    ["Skin is a perfect barrier, while lungs absorb everything instantly", "The chemical turns into a different substance once it is inhaled", "Only the concentration matters, never how a chemical gets in"],
    "How something gets in -- swallowed, breathed or absorbed through skin -- changes what reaches the rest of the body. A claim about one route does not carry over to another."),
  q("f_exposure_pathways", 2, "Something swallowed often passes through the liver first. What does that mean compared with something inhaled?",
    "The liver can remove a lot of it before it reaches the rest of the body, while an inhaled substance skips that step",
    ["Inhaled substances are always less harmful than swallowed ones, because the lungs filter everything before it is absorbed", "The liver only processes food and nutrients, so it plays no part in what happens to a swallowed chemical", "A swallowed substance always reaches the bloodstream faster than an inhaled one, whatever it is"],
    "Toxicologists call the whole trip absorption, distribution, metabolism and excretion (ADME). For an oral exposure the first pass through the liver can clear much of it; inhalation bypasses that."),

  q("f_medication_dose", 1, "What does the acetaminophen (Tylenol) example show?",
    "The same molecule can help at a normal dose and cause serious harm at a large enough one",
    ["Medicines are dangerous whatever the amount, so it is safest to avoid them", "Natural remedies are always gentler than medicines, however much is taken", "Overdoses only ever happen when someone takes a medicine on purpose"],
    "It is the clearest everyday example of dose-response: a well-tolerated medicine under about 3-4 grams a day and a leading cause of sudden liver failure well above it."),
  q("f_medication_dose", 2, "Why can taking a cold remedy and a pain reliever together lead to an unintended overdose?",
    "Both may contain acetaminophen, so the total adds up without anyone counting it",
    ["Different medicines always cancel each other out, so combining them is safe", "Cold remedies are simply stronger than pain relievers and add to them", "Labels on combination products are usually wrong about their ingredients"],
    "Nearly 4 in 10 of the unintentional cases in the US multicenter liver-failure study involved two products that both contained acetaminophen. Checking the ingredient list for a shared ingredient is the habit."),

  q("f_nutrition_toxicity", 1, "Iron, vitamin A and sodium follow a \"U-shaped\" pattern. What does that mean?",
    "Too little and too much each cause problems, with a target range in between",
    ["Less is always safer, and the best amount of any of them is none", "More is always better, because the body simply stores what it does not use", "They have no effect on health at any amount, so the label is only marketing"],
    "Deficiency causes one set of problems, excess another, and the target is a range -- not zero. Nutrition science sets both a floor and a ceiling for that reason."),
  q("f_nutrition_toxicity", 2, "Why is \"less is always better\" the wrong rule for every flagged substance?",
    "Some are nutrients with a minimum your body needs, as well as a ceiling",
    ["Regulators ban every nutrient once it is flagged, so the rule does not arise", "Nothing that is flagged has ever been studied, so no rule can be applied", "Every flagged substance is a nutrient, so there is a floor for all of them"],
    "Some flagged substances are toxins to minimize; others are nutrients to get right. Telling them apart is part of reading a flag."),

  // ---------------------------------------------------------------- Practitioner
  q("p_study_designs", 1, "A headline says a chemical \"kills cells in a dish.\" What kind of evidence is that?",
    "An in vitro (cell) test",
    ["A human study of people exposed to the chemical", "An animal (in vivo) study of whole bodies", "A computer (in silico) prediction from chemical structure"],
    "Cell tests screen mechanisms quickly, but cells lack a body. \"Kills cells in a dish\" and \"harms people\" are very different claims."),
  q("p_study_designs", 2, "How is confidence in a finding best built?",
    "By agreement across models, cells, animals and people",
    ["From a single very large study, whatever kind of study it is", "From whichever study is the newest on the topic", "From how many news stories report the finding"],
    "Each method has blind spots -- models are only as good as their data, animals are not people, human studies are messy. Confidence comes from agreement across all of them."),

  q("p_confounding", 1, "People who drink more coffee also smoke more, and coffee starts to look harmful. What is smoking, in this example?",
    "A confounder",
    ["A placebo", "The outcome being measured", "The control group"],
    "A confounder is a hidden third factor that goes with both. Comparing smokers with smokers, and non-smokers with non-smokers, shows what coffee itself does."),
  q("p_confounding", 2, "Which phrase in a study summary is the most reassuring?",
    "\"After adjusting for age, smoking, diet and income...\"",
    ["\"After a careful review by a panel of independent experts...\"", "\"Experts in the field broadly agree that...\"", "\"Numerous studies have consistently shown that...\""],
    "Researchers adjust for the confounders they thought to measure, and saying which ones is good practice. Not being told what was adjusted for is a red flag."),

  q("p_thresholds", 1, "How is a reference dose typically reached?",
    "Start from the highest dose with no observed harm, then divide by safety factors",
    ["Average the results of every study ever published on the chemical", "Use the lowest dose that has ever caused harm in any animal", "Ask the manufacturer to propose a level it considers acceptable"],
    "Regulators start from a no-observed-adverse-effect level or a benchmark dose and divide -- commonly by 10 for animal-to-human and 10 for differences between people."),
  q("p_thresholds", 2, "A limit has a 100-fold margin built in, and an exposure is slightly over it. What does that mean?",
    "It is not a cliff: being over a limit does not by itself mean harm, it means the margin has narrowed",
    ["Harm is now certain, because a limit marks the exact point where effects begin for everyone", "Nothing at all, since limits are arbitrary numbers that mean nothing for real exposures", "The limit must have been set incorrectly, and the safety factors should be recalculated"],
    "A reference dose is a deliberately protective convention. Being below it means a wide margin; being slightly above means less margin, not a line crossed."),

  q("p_ci", 1, "A study reports a hazard ratio of 4.53 with a 95% interval of 2.00 to 10.27. What does the interval tell you?",
    "The data fit a modest effect or a very large one: the estimate is imprecise",
    ["The effect is exactly 4.53, and the interval only shows rounding", "The estimate is very precise, because the range is centered on 4.53", "There is no effect, because the interval is wide"],
    "The number is a best guess; the interval shows how far off it could be. A wide interval means the data are consistent with a wide range of effects."),
  q("p_ci", 2, "A confidence interval includes 1.0 (no effect). What follows?",
    "The study cannot rule out no effect",
    ["The study proved there is no effect", "The effect is large and certain", "The study must have been biased"],
    "An interval that includes 1.0 leaves \"no effect\" among the possibilities. It does not prove there is none -- it says the study could not tell."),

  q("p_aggregate", 1, "What does \"your home is a shared exposure\" suggest?",
    "Improvements can help everyone at home, and different people there may be affected differently",
    ["Only the person who bought or used a product is ever affected by what it releases indoors", "Homes have no shared air, so each person's exposure at home is entirely their own", "Nothing that is done inside a home changes anything for the people living there"],
    "Shared kitchens, air and routines mean one change often helps everyone. A baby, someone pregnant or someone with a health condition may be affected differently."),
  q("p_aggregate", 2, "The exposome idea is to think about...",
    "The totality of exposures across a life, not one chemical at a time",
    ["Only the outdoor air a person breathes over the course of a year", "Only the chemicals that are found in food and drinking water", "Only the exposures a person meets at work, in an occupation"],
    "No single item is usually the whole story: the running total across food, air, dust and products is what matters."),

  q("p_sensitization", 1, "How is sensitization different from ordinary dose-response?",
    "Once the immune system is primed, a much smaller later exposure can trigger a reaction",
    ["More dose always gives more effect, exactly as in ordinary dose-response", "It only happens at very large doses, well above everyday amounts", "It never involves the immune system, so it is a purely chemical effect"],
    "A first exposure can prime the immune system with no visible symptoms; a much smaller later exposure then triggers a reaction, as with nickel or some fragrance ingredients."),
  q("p_sensitization", 2, "Someone has used a product for years, then suddenly reacts to it. What is the likely explanation?",
    "Sensitization can develop quietly and show up suddenly",
    ["The product must have changed its formula without saying so", "That is impossible after so many years of trouble-free use", "They now need a larger amount than before to react at all"],
    "The priming already happened without symptoms. Once sensitized, avoiding the product -- not using a smaller amount -- is the practical response."),

  q("p_mixtures", 1, "How do combined exposures usually behave?",
    "Roughly the sum of each one's own effect, with true synergy the exception",
    ["Always far worse than the sum, because chemicals amplify one another", "They cancel each other out, so a mixture is safer than its parts", "Always identical to a single exposure, however many substances are present"],
    "Effects of a mixture are usually additive. Documented synergies are real but concentrated in specific pairings, and mostly shown at doses well above everyday exposure."),
  q("p_mixtures", 2, "How do regulators commonly handle mixtures?",
    "Group chemicals that act through the same pathway and assume their doses add",
    ["Ignore mixtures altogether, because each chemical is judged on its own", "Ban every combination of chemicals that has not been individually tested", "Test every possible combination of chemicals before setting any limit"],
    "Assuming doses add within a group is a protective default -- it does not require testing every combination."),

  q("p_swaps_show_up", 1, "Why can a product swap show up in your own measurements within days, for many everyday compounds?",
    "The body clears them quickly (short half-lives)",
    ["They are stored in the body for life, so any change is temporary noise", "They are never absorbed, so the tests are picking up something else", "The urine tests used in these trials are too unreliable to show anything"],
    "The body clears phthalates, parabens and BPA quickly, so what you use shows up fast -- and a change lasts only as long as the habit does."),
  q("p_swaps_show_up", 2, "How should the product-swap trials be read?",
    "As small before-and-after experiments, not proof of a health benefit",
    ["As proof that swapping products prevents disease over the long term", "As proof that swapping products changes nothing about your exposure", "As irrelevant to individuals, because they only describe large groups"],
    "They were short, had no comparison group and measured recent exposure rather than disease. They show that exposure responds, not what the change does for health."),

  // ---------------------------------------------------------------- Advanced
  q("a_nonmonotonic", 1, "What is a non-monotonic dose-response?",
    "One where the slope changes direction, so a low dose can do something a moderate dose does not",
    ["One where the effect always rises smoothly and predictably as the dose goes up and up", "One where there is no effect at any dose, however large", "One that can only be measured in animals and never in people"],
    "Reviews have documented such patterns for natural hormones and for some endocrine-disrupting chemicals. How often it matters for human health is debated."),
  q("a_nonmonotonic", 2, "Why can high-dose-only testing miss real effects for some hormone-active chemicals?",
    "Low-dose effects may not be predicted from high-dose results, especially in early development",
    ["Hormones do not respond to dose, so any test would miss them equally", "High doses are never used in testing, only the lowest realistic ones", "It cannot -- high-dose tests always tell the whole story for every chemical"],
    "It is a reason to avoid both extremes: \"any dose is dangerous\" and \"high-dose tests always tell the whole story\"."),

  q("a_multiple", 1, "With a 5% significance cutoff, about how many \"significant\" results would you expect by chance from testing 20 unrelated things?",
    "About one",
    ["None", "About ten", "All of them"],
    "Test enough relationships and some will look significant by luck alone -- which is why a single finding is more likely wrong than right when studies are small and many things are tested."),
  q("a_multiple", 2, "Which result deserves more weight?",
    "A replicated result from large, well-designed studies using different methods",
    ["A single striking finding on a hot topic that tested many outcomes", "The newest study, whatever its size or how it was designed", "The one with the boldest headline and the most media coverage"],
    "This is not a reason to distrust science; it is a reason to weigh replication, size and agreement across methods above any one striking result."),

  q("a_causation", 1, "Which of these is NOT one of Bradford Hill's viewpoints for judging causation?",
    "How many news stories mention it",
    ["Strength of the association", "Consistency across studies", "That the cause comes before the effect"],
    "Hill listed strength, consistency, timing, dose gradient, plausibility and more. They are viewpoints for judgment, not a checklist that outputs yes or no."),
  q("a_causation", 2, "Which of Hill's considerations is the one essential condition?",
    "Temporality: the cause has to come first",
    ["A plausible biological mechanism that explains the link", "A dose gradient: more exposure giving more effect", "The strength of the association, however large the number"],
    "The others add weight; without the cause preceding the effect there is no causal claim to weigh."),

  q("a_omics_nams", 1, "A study reports that a chemical changed gene expression in cells. What does that establish?",
    "A clue about mechanism, not proof of harm at real-world exposures",
    ["That the chemical harms people at the exposures they meet every day", "That the chemical is safe, since cells simply adapted to it", "Nothing at all, because gene expression changes are meaningless"],
    "\"It altered gene expression in cells\" is not a health outcome. Omics methods measure many molecules at once to see how the body responds; what that means for health still has to be shown."),
  q("a_omics_nams", 2, "What do new approach methodologies combine?",
    "In vitro assays, in silico models and toxicokinetic modelling",
    ["Animal tests carried out on larger and larger groups of animals", "Consumer surveys about how people feel after using a product", "Clinical trials in which volunteers are dosed with the chemical"],
    "Together they help prioritize chemicals and estimate points of departure faster than animal studies alone, translating a concentration in a dish into a dose in a person."),

  q("a_susceptibility", 1, "Why can the same exposure matter more during pregnancy or early childhood?",
    "Development is a window of susceptibility",
    ["Adults do not absorb chemicals the way a growing child does", "Children are always exposed to far more chemicals than adults", "Safety factors do not exist for exposures during pregnancy"],
    "Exposures during pregnancy and early childhood can matter more than the same exposure later, which is why extra care around them is well founded."),
  q("a_susceptibility", 2, "Why is guidance written for \"the average adult\" not enough for everyone?",
    "Averages hide the tails: age, kidney and liver function, genetics and conditions change how the body handles a chemical",
    ["Adults differ so little from one another that an average describes nearly everyone", "Guidance for the average adult is always wrong and should be ignored", "Averages are calculated incorrectly, so they underestimate every dose"],
    "Safety factors are meant to cover variation between people, but a baby, a pregnancy or someone with a health condition may sit in the tail. That is why this app asks about life stage and health."),

  q("a_pathway_perturbation", 1, "In an adverse outcome pathway, what is a molecular initiating event?",
    "The first link -- for example a chemical binding a specific receptor",
    ["The final health outcome that appears in a person", "A regulatory decision to restrict a chemical", "An animal test used to set a safety factor"],
    "The chain runs from a molecular initiating event, through key events at cell, tissue and organ level, to an adverse outcome that matters for health."),
  q("a_pathway_perturbation", 2, "A headline says a chemical \"binds a hormone receptor.\" What is the careful reading?",
    "It is one link in a chain; whether the chain reaches a health outcome may not have been shown",
    ["Harm has been proven, because binding a receptor is what causes disease", "It is meaningless, since receptors bind many things all the time", "It shows the chemical is safe, because the body has a place for it"],
    "A well-documented first link with no shown downstream key events is a mechanistic hypothesis, not a shown health effect. Asking how many links the study covered is the habit."),
];

export const checksForLesson = (lessonId: string) => CONCEPT_CHECKS.filter((c) => c.lessonId === lessonId);
export const checkById = (id: string) => CONCEPT_CHECKS.find((c) => c.id === id);
