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

/**
 * Questions on the elective modules (data/modules.ts). Kept apart from CONCEPT_CHECKS so that the core recall share, which the
 * Understanding part divides by CONCEPT_CHECKS.length, does not shrink when a module is added; they join the same spaced review.
 */
export const MODULE_CHECKS: ConceptCheck[] = [
  // ------------------------------------------------------------------------------------------------ Cancer & prevention
  q("c_classification", 1, "A news story says a food additive was just classified as \"possibly carcinogenic\" (Group 2B). What does that classification tell you?",
    "Limited evidence it can cause cancer under some conditions -- not the chance at the amounts people eat",
    ["That a known share of the people who eat it regularly will go on to develop cancer from it", "That it causes more cancer than anything in Group 3, because the groups rank how potent agents are", "That regulators have banned it, so every product that contains it must be taken off shop shelves at once"],
    "IARC groups rate how strong the evidence is that something can cause cancer; in IARC's own words they do not measure the likelihood that cancer will occur at a particular level of exposure. How much, how often and for whom still decide what it means."),
  q("c_classification", 2, "Tobacco smoking and outdoor air pollution are both in IARC Group 1. What follows from that?",
    "Both have strong evidence behind them, but their effects at everyday exposures can differ greatly",
    ["Breathing city air for a year is about as likely to cause lung cancer as smoking for a year", "Neither can be compared with anything outside Group 1, because the group sets the size of the effect", "Air pollution must be the more serious of the two, because far more people around the world breathe it"],
    "The same group means equally strong evidence, not an equal effect. IARC notes that smoking carries a far larger chance of lung cancer than second-hand smoke or outdoor air pollution, although all three are in Group 1."),

  q("c_where_prevention_works", 1, "A friend reads that \"40% of cancers are linked to modifiable factors\" and says a relative's cancer must have been preventable. What is the careful reply?",
    "That figure describes a whole population; it cannot say why any one person's cancer happened",
    ["Four in ten people with cancer could each have avoided it by changing two or three habits", "The figure only applies to smokers, so for everyone else cancer is entirely a matter of their genes", "If the relative never smoked, the cancer must have come from their diet or their body weight"],
    "Attributable shares are population numbers: they show where prevention can do the most across millions of people. Many cancers arise with no identifiable cause, partly from chance copying errors as healthy cells divide -- a cancer is never a verdict on anyone's choices."),
  q("c_where_prevention_works", 2, "In the 2024 American Cancer Society analysis, which factors accounted for the largest shares of US cancer cases, in order?",
    "Cigarette smoking, then excess body weight, then alcohol",
    ["Alcohol, then outdoor air pollution, then processed meat", "Excess body weight, then sun exposure, then cigarette smoking", "Processed meat, then cigarette smoking, then alcohol"],
    "Cigarette smoking accounted for about 19% of cases, excess body weight about 8% and alcohol about 5%, followed by diet, physical inactivity, sun exposure and infections -- a short list where prevention has the most room."),

  q("c_breast_background", 1, "A woman's mother had breast cancer. Based on the pooled data in this lesson, which statement is closest?",
    "Her odds are higher than average, but most women with one affected relative never develop it",
    ["She will almost certainly develop breast cancer at some point, most likely before the age of 50", "Her odds are no different from anyone else's, because family history matters only for BRCA carriers", "She should assume she carries a BRCA variant, since nearly all family clusters come from one"],
    "One affected mother, sister or daughter raised the odds about 1.8 times; the estimated chance by age 80 was about 13% with one affected relative, against about 8% with none. Most women with a family history never develop breast cancer."),
  q("c_breast_background", 2, "Who does the US Preventive Services Task Force say should be offered a brief assessment for harmful BRCA1/2 variants?",
    "Women whose personal or family history, or whose ancestry, is linked to harmful BRCA1/2 variants",
    ["Every woman over 40, whether or not anyone in her family has had breast or ovarian cancer", "Only women who have already been diagnosed with breast cancer and have since finished their treatment", "No one -- genetic testing for BRCA1/2 is kept for research studies and is not offered in clinics"],
    "The Task Force recommends a short family-history assessment for women whose family or ancestry suggests a harmful variant, then genetic counseling and, if indicated, testing -- not routine testing for everyone."),

  q("c_breast_levers", 1, "A headline says each daily drink raises breast cancer odds \"by 7%\". What is the most useful next question?",
    "Seven percent of what baseline -- what is the chance with and without that drink, out of how many women?",
    ["Whether 7% means that one in every fourteen women who drink daily will go on to develop breast cancer later", "Whether the effect disappears completely once a person switches to wine instead of beer or spirits", "Whether the study was published recently, since older findings about alcohol no longer apply today"],
    "About 7% higher relative odds per daily drink is a ratio; absolute numbers need the baseline. In pooled data from 53 studies, alcohol accounted for around 4% of breast cancers in high-income countries."),
  q("c_breast_levers", 2, "In the pooled analysis in this lesson, which kind of menopausal hormone therapy was not linked to higher breast cancer odds?",
    "Vaginal estrogen",
    ["Estrogen plus daily progestagen", "Estrogen plus intermittent progestagen", "Estrogen-only tablets taken daily"],
    "Every type except vaginal estrogen was linked to some excess -- largest for estrogen plus daily progestagen (about one extra breast cancer per 50 users over five years from 50) and smallest for estrogen alone (about one per 200)."),

  q("c_screening", 1, "For every 10,000 women invited to screening from age 50 for 20 years, the UK review estimated about 43 breast cancer deaths prevented. What other number belongs beside it?",
    "About 129 cancers found that would otherwise never have come to light",
    ["About 10,000 women who will never need to think about breast cancer again", "About 43 cancers caused by the X-rays used over the twenty years of screening", "Nothing else -- the number of deaths prevented is the whole story of screening"],
    "The honest version gives benefits and harms out of the same number of people: about 43 breast cancer deaths prevented, and about 129 cancers found by screening that would otherwise never have come to light."),
  q("c_screening", 2, "Mammograms use a small X-ray dose. How does the modeling in this lesson put that in proportion?",
    "About 125 radiation-linked cancers per 100,000 women screened yearly, against about 968 deaths prevented",
    ["The dose is so small that no breast cancers at all can come from it, whatever the number of mammograms taken", "Radiation-linked cancers outnumber the deaths prevented, so screening should not begin before age 60", "About 968 radiation-linked cancers per 100,000 women screened yearly, against about 125 deaths prevented"],
    "Dose-response applies to screening too: modeling of yearly mammograms from 40 to 74 estimated about 125 radiation-linked breast cancers per 100,000 women, against about 968 breast cancer deaths prevented."),

  q("c_common_worries", 1, "A post says antiperspirants cause breast cancer. What does the evidence in this lesson show?",
    "A population study of 1,606 women found no link with antiperspirant or deodorant use",
    ["Antiperspirants were shown to cause it in the 2004 study that measured chemicals in tumours", "No one has ever studied the question, so neither a link nor its absence can be claimed", "The link is clear, but only for women who apply them within an hour of shaving"],
    "A case-control study of 1,606 women found no higher odds with antiperspirant or deodorant use, including use soon after shaving. 'Not borne out so far' is the honest summary."),
  q("c_common_worries", 2, "Parabens were measured in breast tumour tissue in 2004. Why doesn't that show they caused the tumours?",
    "Finding a chemical shows exposure; with no normal tissue to compare, cause could not be judged",
    ["Because parabens break down within minutes and could not have stayed in the tissue for long", "Because the tumours were removed in surgery, which adds parabens to the tissue during the operation", "Because chemicals cannot be measured in human tissue at all, so the results must be a lab mistake"],
    "Detection shows exposure, not cause. The study had no normal tissue to compare, and the authors themselves named that comparison as the next question."),

  q("c_timing", 1, "In the California DDT study, which women showed higher breast cancer odds with high DDT levels?",
    "Women first exposed before age 14",
    ["Women first exposed after age 30", "All exposed women, whatever their age", "Only women who had never given birth"],
    "High DDT levels predicted about five times the odds of breast cancer before 50 -- but only among women first exposed before age 14. Women exposed only later showed no link: timing matters as much as amount."),
  q("c_timing", 2, "A study measures a chemical in 60-year-olds and finds no link with a cancer. What should a careful reader ask?",
    "Whether the exposure that mattered happened decades earlier, in a window this study could not see",
    ["Nothing further -- a study of older adults settles the question for every age and every exposure", "Whether the chemical is natural, since natural chemicals cannot change cancer odds at any age", "Whether the cancer was found by screening, since screen-detected cancers never relate to any exposure"],
    "Cancers usually appear decades after the exposures that contributed, and some windows -- before birth, childhood, puberty, pregnancy -- count for more. Measuring late in life can miss the window that counted."),

  q("c_after_treatment", 1, "People who are more active after a cancer diagnosis tend to do better in observational studies. What can such studies not fully show?",
    "That activity itself causes the difference, apart from everything else that differs between people",
    ["That being more active is linked with doing better at all, since the studies found no pattern", "That survivors can be active safely, since none of the participants were followed after treatment", "That diet matters too, because these studies only ever counted how many steps people took each day of the week"],
    "Much of the survivorship evidence is observational: more active people tend to do better, but these studies cannot fully separate cause from everything else that differs between people."),
  q("c_after_treatment", 2, "A cancer comes back in someone who followed every guideline closely. What does the lesson say about that?",
    "It is not a verdict on effort; tumour biology and treatment matter more than any single choice",
    ["It means they must have missed a guideline, since following all of them reliably prevents a recurrence", "It shows the guidelines are useless and that daily habits have no connection to health after cancer", "It means the first diagnosis must have been mistaken, because a treated cancer cannot come back"],
    "Survivorship advice is not a promise, and a recurrence is not a verdict on effort: the biology of the tumour and its treatment matter more than any single choice."),

  // ------------------------------------------------------------------------------------------ Cosmetics & personal care
  q("m_label", 1, "On a US cosmetics label, what does the order of the ingredients tell you?",
    "Above 1%, they run from most to least; at 1% or below, they can appear in any order",
    ["Nothing at all -- makers may list every ingredient in whatever order they like", "Ingredients are listed alphabetically, so their position says nothing about amount", "The last ingredient on the list is always the one present in the very largest amount"],
    "Ingredients must be declared in descending order of predominance, but those at 1% or less may be listed in any order after the rest. The first few tell you what most of the product is."),
  q("m_label", 2, "A lotion says \"hypoallergenic\" on the front. What does that word guarantee in the US?",
    "Nothing in particular -- it has no federal definition; the ingredient list says more",
    ["That it passed an FDA allergy test before it could be sold with that word printed on it", "That it contains no fragrance, no dyes and no preservatives of any kind whatsoever", "That a dermatologist reviewed it and found it suitable for people with sensitive skin"],
    "FDA says there are no federal standards or definitions for 'hypoallergenic' -- the term means whatever a particular company wants it to mean. The ingredient list is the more reliable guide."),

  q("m_fragrance", 1, "Someone's skin reacts to a scented body wash. Which explanation does the evidence in this lesson make most likely?",
    "An allergy to one specific ingredient, which a dermatologist's patch test can identify",
    ["A buildup of toxins from years of product use, which a cleanse would then flush back out", "A reaction to the water in the product, since water is the first ingredient listed", "Long-term harm from the dose of fragrance, which always shows up first as a rash"],
    "Fragrance mixes are among the most common skin allergens -- second only to nickel among 125,436 people patch-tested in Central Europe. Allergy follows its own rules, and patch testing can name the ingredient."),
  q("m_fragrance", 2, "After European action on the preservative methylisothiazolinone, what happened to allergy to it?",
    "The wave of allergy to it rose and then fell",
    ["It kept rising, because sensitization never fades", "It vanished within a month of the new rules", "It simply moved on to a different preservative"],
    "Reducing exposure works even for allergy: after European action on methylisothiazolinone, the wave of contact allergy to it rose and then fell in clinic data."),

  q("m_regulation", 1, "A cosmetic's ad says it is \"FDA-approved\". What is true?",
    "Apart from color additives, FDA does not approve cosmetics before they go on the market",
    ["Every cosmetic sold in the US passes an FDA safety review before it reaches the shelf", "FDA approval is optional, and products that have it passed a full panel of human tests", "Only cosmetics sold online need FDA approval; products sold in stores are exempt from it"],
    "FDA states that the law does not require cosmetic products and ingredients, other than color additives, to have FDA approval before they go on the market."),
  q("m_regulation", 2, "What did the Modernization of Cosmetics Regulation Act of 2022 add?",
    "Facility registration, product listing, safety records, serious adverse event reports and recall power",
    ["Pre-market FDA approval for every product, with a full ingredient review before any product is sold", "A ban on all fragrance ingredients and on every preservative named in the European cosmetics annexes", "A rule that labels may no longer say 'fragrance' and must instead name every chemical in the blend"],
    "The 2022 law added duties -- registering facilities, listing products and ingredients, keeping safety evidence, reporting serious adverse events within 15 business days -- and gave FDA the power to order recalls."),

  q("m_skin_dose", 1, "A body lotion and a shampoo contain the same ingredient at the same concentration. Which usually delivers more through skin?",
    "The lotion, because a leave-on product stays in contact for hours instead of seconds",
    ["The shampoo, because hot water opens the skin and lets everything through at once", "Neither -- the same concentration always means the same dose, however it is used", "The shampoo, because rinse-off products are spread over a larger area of the body"],
    "Through skin, the dose depends on contact time, amount and frequency, not only on what's in a product. A leave-on cream stays for hours and a rinse-off wash for seconds, which is why safety panels treat the two uses differently."),
  q("m_skin_dose", 2, "Teenagers switched for three days to products labelled free of certain parabens, phthalates, triclosan and benzophenone-3. What happened?",
    "Most of those chemicals in their urine fell by a quarter to a half",
    ["Nothing measurable changed, because skin products never reach the bloodstream", "Every one of those chemicals disappeared from their urine within a single day", "Levels rose at first, because switching products releases chemicals stored in fat"],
    "In three days most of the targeted chemicals in urine fell by a quarter to a half, though two other parabens unexpectedly rose -- what reaches you through products can be measured, and it moves within days."),

  // ---------------------------------------------------------------------------------------------------- The exposome
  q("e_exposome", 1, "What did Christopher Wild mean by the \"exposome\" when he coined the term in 2005?",
    "Everything a person is exposed to from conception onward, together with the body's responses",
    ["The full set of genes a person inherits, read from a single blood sample taken at birth", "The chemicals in one person's home, measured once with a set of air and water tests", "The share of a disease explained by genes, estimated from studies of identical twins"],
    "Wild coined the term to complement the genome: diet, air, water, products, work, infections, stress and social conditions from conception onward, together with the body's responses to them."),
  q("e_exposome", 2, "A study of 44,788 twin pairs found that inherited genes made a minor contribution to most common cancers. What does that suggest?",
    "Much of the variation lies with environment and chance -- which is where change is possible",
    ["Genes play no part in any cancer, including the ones linked to BRCA1 and BRCA2 variants", "Cancer is mostly decided at birth, so measuring exposures later in life adds very little", "Twins share all of their exposures, so the study cannot tell us anything about environment"],
    "Inherited genes made a minor contribution to most common cancers, leaving much of the variation to environment and chance. That is encouraging, because the exposome is where change is possible."),

  q("e_measuring", 1, "A report says a chemical was \"detected in\" most people's urine in a national survey. What is the careful reading?",
    "It shows exposure is common; what it means depends on how much, compared with what",
    ["It proves most people are being harmed, since any detectable amount is above a safe level", "It means the lab made a mistake, because chemicals cannot be measured in urine samples", "It shows the chemical is harmless, because surveys only report chemicals with no effects"],
    "Detection depends on how sensitive the lab is; meaning depends on how much, compared with what. Surveys like NHANES measure chemicals in blood and urine to set reference ranges and track trends."),
  q("e_measuring", 2, "An environment-wide study tested 266 factors against type 2 diabetes and flagged a few. Why are those flags leads rather than proof?",
    "Testing hundreds of things at once guarantees some chance findings, and one sample is a snapshot",
    ["Because diabetes cannot be influenced by anything in the environment, only by a person's genes", "Because 266 factors is far too few to find anything real, so every one of the flags must be a mistake", "Because the study used blood samples, and blood never contains any environmental chemicals"],
    "Screening hundreds of exposures together finds some associations by chance, and a single blood sample is only a snapshot of a lifetime -- so flagged factors are leads to test, not proof."),

  q("e_your_week", 1, "What slice of the exposome does this app measure?",
    "What you log, your shelf, the places you spend time and your air -- not what is in your blood",
    ["Everything you are exposed to, including the chemicals in your blood, worked out from your logs", "Only your genes, read from the products you scan and the places you describe in the app", "Nothing at all, since an exposome can only ever be measured inside a research laboratory"],
    "This app measures a small, honest slice: what you log, what is on your shelf, the places you spend time and your air. It does not measure what is in your blood, and it does not try."),
  q("e_your_week", 2, "Why is a one-week swap a reasonable experiment to run?",
    "Swap studies saw urinary levels fall within days, and a week shows whether a change fits a routine",
    ["Because every exposure takes exactly seven days to leave the body, whatever the chemical is", "Because one week is long enough to show a change in a person's own cancer odds afterwards", "Because anything that does not work within a week has been shown to make no difference"],
    "Product and food swap studies saw urinary levels of several chemicals fall within days, and a week is long enough to see whether a change fits your routine. One swap, one week, then look again."),
];

export const ALL_CHECKS: ConceptCheck[] = [...CONCEPT_CHECKS, ...MODULE_CHECKS];

export const checksForLesson = (lessonId: string) => ALL_CHECKS.filter((c) => c.lessonId === lessonId);
export const checkById = (id: string) => ALL_CHECKS.find((c) => c.id === id);
