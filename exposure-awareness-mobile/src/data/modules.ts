/**
 * Elective modules: topics a person can go deeper on once the foundation lesson each one builds on has been read. They sit
 * beside the three-tier core curriculum rather than inside it, so adding a module never changes anyone's tier, curriculum share
 * or Understanding score; reading one can only add a little (engine/signals/understanding.ts).
 *
 * Every number below was read in the source itself on 2026-10-02 -- the PubMed record (linked as evidence) or the agency's own
 * page (FDA on cosmetics, IARC on its classifications). Nothing here is medical advice, and nothing assigns blame.
 */
import { LESSONS, type Lesson } from "./curriculum";

export type ModuleId = "cancer" | "cosmetics" | "exposome";

export const MODULE_ORDER: ModuleId[] = ["cancer", "cosmetics", "exposome"];

export const MODULE_INFO: Record<ModuleId, { icon: string; title: string; blurb: string }> = {
  cancer: { icon: "🎗️", title: "Cancer & prevention", blurb: "What the evidence says about cancer and everyday exposures -- breast cancer included -- in proportion, without blame." },
  cosmetics: { icon: "🧴", title: "Cosmetics & personal care", blurb: "Reading labels, who checks products, and how much reaches you through skin." },
  exposome: { icon: "🌐", title: "The exposome", blurb: "Everything you meet over a lifetime, and the science starting to measure it." },
};

export interface ModuleLesson extends Lesson {
  module: ModuleId;
  /** lessons to read first -- each one teaches an idea this lesson uses */
  prereqs: string[];
}

export const MODULE_LESSONS: ModuleLesson[] = [
  // ------------------------------------------------------------------------------------------------ Cancer & prevention
  {
    id: "c_classification", module: "cancer", tier: 1, prereqs: ["f_hazard_risk"],
    title: "What 'causes cancer' labels really mean",
    headline: "A cancer classification says how sure the evidence is that something can cause cancer -- not how much it does at the amount you meet.",
    body: [
      "The International Agency for Research on Cancer (IARC) sorts agents into Group 1 (carcinogenic to humans), 2A (probably), 2B (possibly) and 3 (not classifiable). The groups rate the strength of the evidence. In IARC's own words, they do not measure the likelihood that cancer will occur at a particular level of exposure.",
      "So two things in one group can differ enormously. Tobacco smoking, second-hand smoke and outdoor air pollution are all in Group 1, yet smoking carries a far larger chance of lung cancer than the other two. Group 2B includes whole-leaf aloe vera extract, on the strength of rat studies. And something never evaluated has not been shown to be safe -- it simply has not been reviewed.",
    ],
    watchFor: "'Classified as a carcinogen' used as if it meant 'gives you cancer', with no word about how much, how often, or for whom.",
    talkAbout: "Pick a 'causes cancer' headline someone shared recently. Which group was it in, and how did the exposure in the studies compare with everyday life?",
    evidenceIds: ["pmid_31498409"],
  },
  {
    id: "c_where_prevention_works", module: "cancer", tier: 1, prereqs: ["f_relative_absolute"],
    title: "Where prevention has the most room",
    headline: "About 4 in 10 cancer cases in US adults are linked to factors that can change -- and a few of those factors account for most of it.",
    body: [
      "A 2024 American Cancer Society analysis estimated that 40% of cancer cases and 44% of cancer deaths in US adults aged 30 and over were attributable to potentially modifiable factors. Cigarette smoking led (about 19% of cases), then excess body weight (about 8%) and alcohol (about 5%), followed by diet, physical inactivity, sun exposure and seven infections that vaccines or treatment can prevent. In Sweden, girls vaccinated against HPV before 17 had about 88% fewer cervical cancers.",
      "These are population numbers. They show where prevention can do the most across millions of people; they cannot say why any one person's cancer happened. Many cancers arise with no identifiable cause, partly from chance copying errors as healthy cells divide. A cancer is never a verdict on anyone's choices.",
    ],
    watchFor: "Prevention statistics turned into personal blame -- 'they must have done something to get it.'",
    talkAbout: "Of the biggest levers -- smoke-free air, alcohol, activity, vaccines, sun -- which has the most room in your household, without anyone feeling judged?",
    evidenceIds: ["pmid_38990124", "pmid_32997908", "pmid_25554788"],
  },
  {
    id: "c_breast_background", module: "cancer", tier: 1, prereqs: ["f_relative_absolute"],
    title: "Breast cancer: family history and genes, in proportion",
    headline: "Family history raises the odds, yet eight in nine women who develop breast cancer have no affected mother, sister or daughter.",
    body: [
      "Pooled data on 58,209 women with breast cancer found that one affected mother, sister or daughter raised the odds about 1.8 times, and two about 2.9 times. In absolute terms, the estimated chance of breast cancer by age 80 was about 8% with no affected relative, 13% with one and 21% with two -- so most women with a family history never develop it.",
      "Inherited BRCA1 or BRCA2 variants are rarer -- about 1 in 300 to 500 women -- and behind 5 to 10% of breast cancers, but they change the picture a lot: about 70% of carriers develop breast cancer by 80. That is why the US Preventive Services Task Force recommends a short family-history assessment for women whose family or ancestry suggests it, then genetic counseling and, if indicated, testing.",
    ],
    watchFor: "Family history treated as destiny -- or its absence treated as protection.",
    talkAbout: "Does your family know its own history: who had breast, ovarian or related cancers, and at what age? That one conversation is where a clinician's risk assessment starts.",
    evidenceIds: ["pmid_11705483", "pmid_31429903", "pmid_28632866"],
  },
  {
    id: "c_breast_levers", module: "cancer", tier: 2, prereqs: ["f_relative_absolute", "f_association"],
    title: "Breast cancer: what's within reach",
    headline: "Alcohol, activity, breastfeeding and the choice of menopausal hormone therapy each shift the odds -- modestly, and in measurable proportion.",
    body: [
      "In pooled data from 53 studies, each daily drink of alcohol (about 10 g) was linked to about 7% higher relative odds of breast cancer -- around 4% of breast cancers in high-income countries. Breastfeeding works the other way: about 4% lower relative odds for every 12 months, on top of about 7% for each birth. High versus low leisure-time activity was linked to about 10% lower odds.",
      "Menopausal hormone therapy has real benefits, and the evidence helps size its cost: for women of average weight starting at 50, five years of use was estimated to add about one breast cancer for every 50 users of estrogen plus daily progestagen, one per 70 with intermittent progestagen and one per 200 with estrogen alone. Vaginal estrogen was not linked to higher odds. These are conversations to have with a clinician, never reasons for guilt about past choices.",
    ],
    watchFor: "Relative changes ('raises it 7%') with no baseline, and single factors treated as if they decided everything.",
    talkAbout: "Which of these is a real option in your life right now -- and which would be easier to change together with someone else?",
    tool: "risk_translator",
    evidenceIds: ["pmid_12439712", "pmid_12133652", "pmid_27183032", "pmid_31474332"],
  },
  {
    id: "c_screening", module: "cancer", tier: 2, prereqs: ["f_relative_absolute"],
    title: "Screening: finding it early, honestly counted",
    headline: "Screening finds some cancers early enough to change the outcome, and some that never would have mattered. Both belong in the decision.",
    body: [
      "The US Preventive Services Task Force (2024) recommends a mammogram every two years for women aged 40 to 74 at average risk. An independent UK review of the trials estimated a 20% lower chance of dying from breast cancer among women invited to screening: for every 10,000 women invited from age 50 for 20 years, about 43 breast cancer deaths prevented, and about 129 cancers found that would otherwise never have come to light (overdiagnosis).",
      "Mammograms use a small dose of X-rays, and dose-response applies here too: modeling of yearly screening from 40 to 74 estimated about 125 radiation-linked breast cancers per 100,000 women, against about 968 breast cancer deaths prevented. For women with a harmful BRCA variant, more intensive screening is one of the options a clinician can discuss.",
    ],
    watchFor: "Screening described only by its benefits, or only by its harms. The honest version gives both numbers, out of the same number of people.",
    talkAbout: "Is anyone in your life due for screening, or unsure when to start? 'When should I begin, given my family?' is a fine first question to bring to a clinician.",
    tool: "risk_translator",
    evidenceIds: ["pmid_38687503", "pmid_23117178", "pmid_26756460"],
  },
  {
    id: "c_common_worries", module: "cancer", tier: 2, prereqs: ["f_association", "f_hazard_risk"],
    title: "Antiperspirants, bras, parabens, soy: checking common worries",
    headline: "Some worries have been studied and not borne out; others carry real signals worth weighing. The difference lies in the evidence, not in how often a claim is repeated.",
    body: [
      "Not borne out so far: a population study of 1,606 women found no link between antiperspirant or deodorant use and breast cancer, and a study of women aged 55 to 74 found none with any aspect of bra wearing, underwires included. Parabens were measured in breast tumour tissue in 2004 -- but with no normal tissue to compare, that showed exposure, not cause, as the authors themselves noted.",
      "Worth weighing: in the Sister Study, permanent hair dye was linked to 45% higher odds among Black women and about 7% among white women, and chemical straighteners to higher odds with more frequent use -- an observational signal, in women who all had a sister with breast cancer. And a worry that turned out reassuring: among 5,042 breast cancer survivors in Shanghai, those eating the most soy had lower recurrence and mortality than those eating the least.",
    ],
    watchFor: "A chemical 'found in' tissue reported as proof that it caused the disease -- and, the other way, a real association waved away because it is inconvenient.",
    talkAbout: "Which health worry gets shared most in your family chat? Look up whether it has been studied, and what the study actually compared.",
    evidenceIds: ["pmid_12381712", "pmid_25192706", "pmid_14745841", "pmid_31797377", "pmid_19996398"],
  },
  {
    id: "c_timing", module: "cancer", tier: 2, prereqs: ["f_dose_response"],
    title: "Timing: when matters as much as how much",
    headline: "The same exposure can matter more at some stages of life, and cancers usually appear decades after the exposures that contributed.",
    body: [
      "Blood saved from young mothers in California in the 1960s, during the years of heavy DDT use, was compared decades later with their breast cancer diagnoses. High DDT levels predicted about five times the odds of breast cancer before 50 -- but only among women first exposed before age 14. Women exposed only later showed no link.",
      "Windows of development -- before birth, childhood, puberty, pregnancy -- are times when tissues are still forming, which is why protecting children and teenagers gets extra weight in public health. The long delay also means today's diagnoses mostly reflect exposures from long ago, when much less was known; there is nothing to gain from guilt about them.",
    ],
    watchFor: "Studies that measure an exposure late in life and conclude it doesn't matter -- the window that counted may have closed decades earlier.",
    talkAbout: "Who in your household is in a developing window right now -- a pregnancy, a child, a teenager -- and is the home set up with them in mind?",
    evidenceIds: ["pmid_17938728"],
  },
  {
    id: "c_after_treatment", module: "cancer", tier: 2, prereqs: ["f_association"],
    title: "After treatment: what the guidelines say",
    headline: "For people after a cancer diagnosis, the American Cancer Society's guideline focuses on a few steady things -- body weight, physical activity, diet and alcohol -- alongside the care team's plan.",
    body: [
      "The guideline, written for survivors, their families and clinicians, draws on systematic reviews, pooled cohort studies and large trials. Much of the evidence is observational: people who are more active after diagnosis tend to do better, but studies like these cannot fully separate cause from everything else that differs between people.",
      "It also attends to what makes the advice doable -- side effects, other health conditions, access to support -- and to the people around the survivor. If a cancer comes back, it is not a verdict on effort: the biology of the tumour and its treatment matter more than any single choice.",
    ],
    watchFor: "Survivorship advice that sounds like a promise ('this will keep it from coming back') -- or that quietly assigns blame if it does.",
    talkAbout: "If someone you love is in treatment or after it, ask what kind of support would actually help -- a walk together, a meal, a ride -- rather than offering advice.",
    evidenceIds: ["pmid_35294043", "pmid_19996398"],
  },

  // ------------------------------------------------------------------------------------------ Cosmetics & personal care
  {
    id: "m_label", module: "cosmetics", tier: 1, prereqs: ["f_exposure_pathways"],
    title: "Reading a cosmetics label",
    headline: "Ingredients are listed from most to least -- until 1%, where the order stops meaning anything.",
    body: [
      "In the US, cosmetic ingredients must be listed in descending order of predominance, but those at 1% or less may appear in any order after the rest. The first few ingredients tell you what most of the product is; the long tail of minor ones can come in whatever order the maker chooses.",
      "One word can stand for many ingredients: 'fragrance' (or 'parfum') can be a mixture of many different chemicals, protected as a trade secret. FDA notes that even some 'unscented' products contain fragrance to mask other smells, and that 'hypoallergenic' has no federal definition -- the term means whatever a particular company wants it to mean.",
    ],
    watchFor: "Front-of-pack words -- 'clean', 'natural', 'non-toxic', 'hypoallergenic' -- read as safety ratings. FDA keeps no list of approved cosmetic claims; the ingredient list is the more reliable guide.",
    talkAbout: "Pick one product you use every day and read its first five ingredients aloud with someone. What is it mostly made of?",
  },
  {
    id: "m_fragrance", module: "cosmetics", tier: 1, prereqs: ["m_label"],
    title: "Fragrance and skin allergy: a different question",
    headline: "With fragrance, the most common problem is not long-term harm from the dose but skin allergy, which follows its own rules.",
    body: [
      "Among 125,436 people patch-tested at dermatology clinics in Central Europe, a standard fragrance mix was the second most common allergen after nickel, positive in about 8%. In a random sample of the general population in five European countries, between 0.7% and 2.6% reacted to the same fragrance mix.",
      "Allergy works differently from ordinary dose-response: once the immune system is sensitized, much smaller amounts can set off a rash. Reducing exposure still works -- after European action on the preservative methylisothiazolinone, the wave of allergy to it rose and then fell. If a product bothers your skin, its ingredient list and patch testing with a dermatologist are better guides than the front label.",
    ],
    watchFor: "Skin reactions blamed on vague 'toxins', when the likelier explanation is an allergy to one specific ingredient that a patch test can identify.",
    talkAbout: "Does anyone at home get rashes from a product? Keeping the ingredient lists of the suspects makes a dermatologist visit far more useful.",
    evidenceIds: ["pmid_32107776", "pmid_30810228"],
  },
  {
    id: "m_regulation", module: "cosmetics", tier: 2, prereqs: ["f_hazard_risk"],
    title: "Who checks cosmetics before they're sold?",
    headline: "In the US most cosmetics reach shelves without FDA approval; a 2022 law added new duties, and the EU asks for a safety assessment first.",
    body: [
      "FDA states that the law does not require cosmetic products and ingredients, other than color additives, to have FDA approval before they go on the market. The Modernization of Cosmetics Regulation Act of 2022 added duties: companies must register facilities, list products with their ingredients, keep evidence that products are safe, and report serious adverse events to FDA within 15 business days -- and FDA gained the power to order recalls. FDA was also directed to write rules on fragrance allergen labeling and on testing talc for asbestos.",
      "In the European Union, makers must show a product is safe before it is placed on the market, and substances classed as causing cancer, genetic damage or harm to reproduction are prohibited except in exceptional cases. Neither system guarantees that every product suits every person; each decides what evidence has to exist, when, and who has to hold it.",
    ],
    watchFor: "'FDA-approved' on a cosmetic. Apart from color additives, there is no such approval to have.",
    talkAbout: "If a product gave you or someone at home a serious reaction, would you have kept the label? Companies now have to pass serious reports on to FDA.",
    evidenceIds: ["pmid_38494042"],
  },
  {
    id: "m_skin_dose", module: "cosmetics", tier: 2, prereqs: ["f_exposure_pathways"],
    title: "Leave-on, rinse-off, and how much reaches you",
    headline: "Through skin, the dose depends on what's in a product, how long it stays on, how much you use and how often -- not just on whether an ingredient is present.",
    body: [
      "Amounts vary hugely: in a US diary study, women used about 14 g of hair conditioner a day, 4 g of facial cleanser and 0.04 g of eye shadow. A leave-on cream stays in contact for hours; a rinse-off wash for seconds. That is why expert safety panels often judge an ingredient fine in rinse-off products while setting a lower limit, or asking for more data, for leave-on use.",
      "What reaches you can be measured. When 100 teenagers switched for three days to personal care products labelled free of certain phthalates, parabens, triclosan and benzophenone-3, most of those chemicals in their urine fell by a quarter to a half (two other parabens unexpectedly rose). A change you can make, and see, within days.",
    ],
    watchFor: "'Contains X' with no mention of whether it is a leave-on or rinse-off product, how much is used, or how often.",
    talkAbout: "Which products in your bathroom stay on your skin all day? Those are the ones where a swap moves the most.",
    evidenceIds: ["pmid_18243463", "pmid_26947464"],
  },

  // ---------------------------------------------------------------------------------------------------- The exposome
  {
    id: "e_exposome", module: "exposome", tier: 3, prereqs: ["f_exposure_pathways"],
    title: "The exposome: the other half of the story",
    headline: "Your genome is set at conception; your exposome -- everything you are exposed to, and how your body responds -- keeps changing for life.",
    body: [
      "The epidemiologist Christopher Wild coined the term in 2005 to complement the genome: diet, air, water, products, work, infections, stress and social conditions, from conception onward, together with the body's responses. Twin studies point the same way -- across 44,788 twin pairs, inherited genes made a minor contribution to most common cancers, leaving much of the variation to environment and chance.",
      "That is encouraging, because the exposome is where change is possible. It is also humbling: exposures overlap, shift over time and leave few lasting traces, so measuring them is far harder than reading a genome. Researchers have called for an effort to map the exposome on a scale comparable to the human genome.",
    ],
    watchFor: "'It's all in your genes' -- and its mirror image, 'it's all your environment'. Most common diseases involve both, plus chance.",
    talkAbout: "If you could measure one part of your household's exposome for a month, which would you pick -- and what would you do with the answer?",
    evidenceIds: ["pmid_16103423", "pmid_10891514", "pmid_31974245"],
  },
  {
    id: "e_measuring", module: "exposome", tier: 3, prereqs: ["e_exposome"],
    title: "How the exposome is measured",
    headline: "Blood and urine samples, personal sensors, and instruments that look for thousands of chemicals at once are making the exposome measurable -- with real limits.",
    body: [
      "The US National Health and Nutrition Examination Survey (NHANES) measures environmental chemicals in the blood and urine of a nationally representative sample, which is how reference ranges and long-term trends are known. Newer untargeted mass spectrometry scans one sample for thousands of chemical features at once, and personal sensors log air and activity around the clock.",
      "Analyses can then screen hundreds of exposures together. One environment-wide study tested 266 factors against type 2 diabetes and flagged a pesticide breakdown product and PCBs -- leads, not proof, because testing hundreds of things at once guarantees some chance findings, and a single blood sample is a snapshot of a lifetime.",
    ],
    watchFor: "A chemical 'detected in' blood or urine read as harm. Detection depends on how sensitive the lab is; meaning depends on how much, compared with what.",
    talkAbout: "Population biomonitoring is how falling blood lead was documented after leaded gasoline was phased out. Which exposure would you want tracked that way?",
    evidenceIds: ["pmid_21937270", "pmid_20505766", "pmid_31974245"],
  },
  {
    id: "e_your_week", module: "exposome", tier: 3, prereqs: ["e_exposome"],
    title: "Your own exposome, one week at a time",
    headline: "This app measures a small, honest slice of your exposome: what you log, what's on your shelf, the places you spend time, and your air.",
    body: [
      "It cannot measure what is in your blood, and it does not try. What it can do is what exposure science does first: estimate sources and how often you meet them, compare them with published guidance, and show what changes when you change something.",
      "Short experiments are surprisingly informative. Product and food swap studies saw urinary levels of several chemicals fall within days, and a week is long enough to see whether a change fits your routine. One swap, one week, then look again: the exposome approach at the scale of a household.",
    ],
    watchFor: "Any tool -- this one included -- that claims to measure your whole exposure. Every method sees a slice; good ones tell you which slice.",
    talkAbout: "What is one swap your household could try for a week, and how would you know whether it stuck?",
    evidenceIds: ["pmid_26947464", "pmid_21450549", "pmid_20966241"],
  },
];

export const ALL_LESSONS: Lesson[] = [...LESSONS, ...MODULE_LESSONS];

export const anyLessonById = (id: string): Lesson | undefined => ALL_LESSONS.find((l) => l.id === id);
export const moduleLessonById = (id: string): ModuleLesson | undefined => MODULE_LESSONS.find((l) => l.id === id);
export const lessonsInModule = (m: ModuleId) => MODULE_LESSONS.filter((l) => l.module === m);
