/**
 * The Starter Journey: a hand-curated, ORDERED list of first steps (not an algorithmic sort).
 *
 * Ordered by leverage, biggest stones first: how much exposure a step plausibly removes, how strong the evidence is,
 * and who shares it, weighed against the cost and effort of doing it. The first three are Tier A sources (radon, smoke
 * indoors, lead-era housing) that are also cheap to act on: a test kit, a house rule, a question about the home's age.
 * Everyday habits follow. (An earlier version ran easiest-first with radon last; the launch plan reversed that, because
 * the cheapest big wins should not wait behind small ones.)
 *
 * Each step links to real substance_ids in hazardDatabase.json, so the Journey is a front door onto the same Learn
 * content, not a separate database. Ids are stable storage keys ("starter:<id>"): reorder freely, never rename.
 */
export interface StarterQuest {
  id: string;
  order: number;
  title: string;
  why: string; // why this is one of the FIRST things to do
  action: string;
  substance_ids: string[];
}

export const STARTER_JOURNEY: StarterQuest[] = [
  {
    id: "starter_radon",
    order: 1,
    title: "Test for Radon",
    why: "Radon is the second-leading cause of lung cancer in the U.S., after smoking, and there is no way to know your level without a test. A short-term kit is inexpensive and takes a few days.",
    action: "Order a $15-25 radon test kit and place it in your lowest lived-in level.",
    substance_ids: ["radon"],
  },
  {
    id: "starter_smoke_free",
    order: 2,
    title: "Keep Smoke Out of Home and Car",
    why: "Smoke indoors is the largest air exposure a household can control, and everyone who shares the space breathes it. The US Surgeon General found no level of secondhand smoke without measurable effects.",
    action: "Make your home and car smoke- and vape-free for everyone, visitors included. If you smoke and want support to stop, free help is at 1-800-QUIT-NOW.",
    substance_ids: ["tobacco_smoke"],
  },
  {
    id: "starter_lead_check",
    order: 3,
    title: "Know Your Home's Lead Era",
    why: "Homes built before 1978 are more likely to have lead paint, and lead pipes are more likely before 1986 (US EPA). Dust from old paint is the main way young children take in lead.",
    action: "Find out when your home was built. If before 1978, damp-dust instead of dry-dusting and use lead-safe methods for any sanding or renovation; if young children live there, ask their doctor about a blood lead test.",
    substance_ids: ["lead_exposure"],
  },
  {
    id: "starter_range_hood",
    order: 4,
    title: "Vent While You Cook",
    why: "If you cook at all, you're doing this multiple times a day. Gas stoves release NO2 with every use, and nonstick pans release more at high heat -- both fixed by the same habit.",
    action: "Run the range hood (or crack a window) every time you use the stove, starting with today's next meal.",
    substance_ids: ["nitrogen_dioxide_gas_stove", "nonstick_cookware_ptfe"],
  },
  {
    id: "starter_water_filter",
    order: 5,
    title: "Read Your Water Report",
    why: "Tap water is a daily route for almost everyone, and your utility publishes what is in it every year. Knowing what is there tells you whether a filter would help, and which kind.",
    action: "Find your water utility's annual Consumer Confidence Report. On a private well, test it through a state-certified lab. If the report names something above guidance, choose a filter certified for that contaminant.",
    substance_ids: ["chlorination_byproducts", "private_well_water"],
  },
  {
    id: "starter_shoes_off",
    order: 6,
    title: "Shoes Off At The Door",
    why: "Whatever's on the bottom of your shoes -- lawn chemicals, street dust, lead-contaminated soil -- gets tracked directly into your carpet and dust, where it lingers far longer than it would outside.",
    action: "Start a shoes-off-at-the-door habit for the household this week.",
    substance_ids: ["lawn_pesticide_tracked_in", "household_dust_reservoir"],
  },
  {
    id: "starter_tupperware",
    order: 7,
    title: "Swap the Tupperware Habit",
    why: "Reheating leftovers in plastic is one of the most common daily household exposures -- most people do it without thinking, several times a week.",
    action: "Reheat leftovers in glass or ceramic instead of plastic, starting today.",
    substance_ids: ["bpa", "microplastics_bottled_water"],
  },
  {
    id: "starter_laundry",
    order: 8,
    title: "Fragrance-Free Laundry",
    why: "Everyone does laundry. A scented detergent or dryer sheet touches every piece of clothing and bedding in the house, worn against skin for hours.",
    action: "Switch your next detergent purchase to a fragrance-free formula -- same price, same clean.",
    substance_ids: ["fragranced_laundry_products"],
  },
  {
    id: "starter_shampoo_label",
    order: 9,
    title: "Check Your Shampoo Label",
    why: "Personal care products are used daily, directly on skin/scalp, often for years without the label ever being read.",
    action: "Look at the ingredient list on your current shampoo or body wash -- log it to see what's actually in it.",
    substance_ids: ["sodium_lauryl_sulfate", "phthalates", "formaldehyde_releasers"],
  },
  {
    id: "starter_breakfast_swap",
    order: 10,
    title: "The Cereal Aisle Swap",
    why: "Breakfast is the most habitual, least-varied meal for most people -- the same box, same bowl, most mornings.",
    action: "Try plain oats + fruit instead of packaged cereal for a few mornings this week.",
    substance_ids: ["artificial_food_dyes", "added_sugar"],
  },
  {
    id: "starter_hvac_filter",
    order: 11,
    title: "Change the HVAC Filter",
    why: "Almost every home/apartment with central air has one of these, and it's one of the most commonly forgotten maintenance items in a house.",
    action: "Check your filter's last-changed date; replace it if it's been more than 3 months.",
    substance_ids: ["hvac_filter_age"],
  },
];

/** The steps that count as the big stones: Tier A sources that are also cheap to act on. */
export const BIG_STONE_STEP_IDS = ["starter_radon", "starter_smoke_free", "starter_lead_check"] as const;
