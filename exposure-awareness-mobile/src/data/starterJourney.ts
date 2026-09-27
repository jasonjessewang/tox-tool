/**
 * The Starter Journey: a hand-curated, ORDERED intro questline (not an algorithmic sort)
 * -- same principle a game's tutorial zone uses. Ordering criteria, in priority order:
 *   1. How many households/workplaces this actually touches (a plastic-container habit
 *      is closer to universal than, say, dry-cleaning use)
 *   2. How low-effort the fix is (every entry here is action_effort "low" in the hazard
 *      database, or "medium" only when the impact clearly justifies it -- see radon)
 *   3. Impact, last -- because a highest-impact-first ordering front-loads the hardest
 *      asks (radon testing, HVAC) before someone has built any momentum, which the
 *      persona test in the notification-design pass flagged as the exact pattern that
 *      gets wellness apps deleted. Momentum first, harder wins later.
 *
 * Each quest links to real substance_ids already in hazardDatabase.json -- the Journey
 * screen is a curated front door onto the same Learn content, not a separate database.
 */
export interface StarterQuest {
  id: string;
  order: number;
  title: string;
  why: string; // prevalence framing -- why this is one of the FIRST things to fix
  action: string;
  substance_ids: string[];
  xp: number;
}

export const STARTER_JOURNEY: StarterQuest[] = [
  {
    id: "starter_tupperware",
    order: 1,
    title: "Swap the Tupperware Habit",
    why: "Reheating leftovers in plastic is one of the single most common daily household exposures there is -- most people do it without thinking, multiple times a week.",
    action: "Reheat leftovers in glass or ceramic instead of plastic, starting today.",
    substance_ids: ["bpa", "microplastics_bottled_water"],
    xp: 10,
  },
  {
    id: "starter_laundry",
    order: 2,
    title: "Fragrance-Free Laundry",
    why: "Everyone does laundry. A scented detergent or dryer sheet touches every piece of clothing and bedding in the house, worn against skin for hours.",
    action: "Switch your next detergent purchase to a fragrance-free formula -- same price, same clean.",
    substance_ids: ["fragranced_laundry_products"],
    xp: 10,
  },
  {
    id: "starter_shoes_off",
    order: 3,
    title: "Shoes Off At The Door",
    why: "Whatever's on the bottom of your shoes -- lawn chemicals, street dust, lead-contaminated soil -- gets tracked directly into your carpet and dust, where it lingers far longer than it would outside.",
    action: "Start a shoes-off-at-the-door habit for the household this week.",
    substance_ids: ["lawn_pesticide_tracked_in", "household_dust_reservoir"],
    xp: 10,
  },
  {
    id: "starter_range_hood",
    order: 4,
    title: "Vent While You Cook",
    why: "If you cook at all, you're doing this multiple times a day. Gas stoves release NO2 with every use, and nonstick pans release more at high heat -- both fixed by the same habit.",
    action: "Run the range hood (or crack a window) every time you use the stove, starting with today's next meal.",
    substance_ids: ["nitrogen_dioxide_gas_stove", "nonstick_cookware_ptfe"],
    xp: 10,
  },
  {
    id: "starter_shampoo_label",
    order: 5,
    title: "Check Your Shampoo Label",
    why: "Personal care products are used daily, directly on skin/scalp, often for years without the label ever being read.",
    action: "Look at the ingredient list on your current shampoo or body wash -- log it to see what's actually in it.",
    substance_ids: ["sodium_lauryl_sulfate", "phthalates", "formaldehyde_releasers"],
    xp: 15,
  },
  {
    id: "starter_breakfast_swap",
    order: 6,
    title: "The Cereal Aisle Swap",
    why: "Breakfast is the most habitual, least-varied meal for most people -- the same box, same bowl, most mornings.",
    action: "Try plain oats + fruit instead of packaged cereal for a few mornings this week.",
    substance_ids: ["artificial_food_dyes", "added_sugar"],
    xp: 15,
  },
  {
    id: "starter_hvac_filter",
    order: 7,
    title: "Change the HVAC Filter",
    why: "Almost every home/apartment with central air has one of these, and it's one of the most commonly forgotten maintenance items in a house.",
    action: "Check your filter's last-changed date; replace it if it's been more than 3 months.",
    substance_ids: ["hvac_filter_age"],
    xp: 15,
  },
  {
    id: "starter_water_filter",
    order: 8,
    title: "Filter Your Water",
    why: "Tap water is a near-universal daily exposure route -- and one of the cheapest to address with a basic filter.",
    action: "Check your water utility's Consumer Confidence Report, or start using a basic activated-carbon filter.",
    substance_ids: ["chlorination_byproducts"],
    xp: 15,
  },
  {
    id: "starter_radon",
    order: 9,
    title: "Test for Radon",
    why: "The 'boss quest' of the starter journey: less frequent an action than the others, but radon is the second-leading cause of lung cancer in the U.S. and is completely invisible without a test.",
    action: "Order a $15-25 radon test kit and place it in your lowest lived-in level.",
    substance_ids: ["radon"],
    xp: 25,
  },
];

export const STARTER_JOURNEY_TOTAL_XP = STARTER_JOURNEY.reduce((sum, q) => sum + q.xp, 0);
