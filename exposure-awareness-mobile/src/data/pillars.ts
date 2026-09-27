export type PillarKey = "health" | "wealth" | "purpose";

export interface Lesson {
  id: string;
  pillar: PillarKey;
  title: string;
  script: string;
}

export interface Pillar {
  key: PillarKey;
  icon: string;
  title: string;
  tagline: string;
}

export const PILLARS: Pillar[] = [
  { key: "health", icon: "🫀", title: "Health", tagline: "How your body handles what it meets" },
  { key: "wealth", icon: "🪙", title: "Wealth", tagline: "Spending time and money where it counts" },
  { key: "purpose", icon: "🧭", title: "Purpose", tagline: "Why any of this is worth doing" },
];

// Short scripts written to be listened to (read aloud on-device) or read. General education,
// not medical or financial advice.
export const LESSONS: Lesson[] = [
  {
    id: "health_dose",
    pillar: "health",
    title: "The dose makes the poison",
    script:
      "Five hundred years ago, Paracelsus observed that everything can be harmful in the wrong amount, and nothing is harmful in a tiny enough one. " +
      "That single idea is the heart of toxicology. It means the question is never just what is in your life, but how much, how often, and for how long. " +
      "Most everyday exposures are small. The ones worth your attention are the ones you meet every day, because repetition adds up. Start there, and let the rest go.",
  },
  {
    id: "health_cleanup",
    pillar: "health",
    title: "Your built-in cleanup crew",
    script:
      "Your liver breaks down foreign chemicals, and your kidneys send the leftovers out. They work around the clock without any cleanse or supplement. " +
      "What you can do is support them the ordinary way: drink water, move your body, eat mostly whole foods, and protect your sleep. " +
      "Think of it as adding good, not scrubbing out bad. The goal is a body that is resilient, not one that is chasing a flush.",
  },
  {
    id: "health_sleep",
    pillar: "health",
    title: "Sleep, the nightly reset",
    script:
      "Sleep is when your body repairs, consolidates memory, and regulates hormones and appetite. Most adults do best with seven or more hours. " +
      "It is also the cheapest health input there is. If you only add one good thing this week, make it a consistent bedtime. " +
      "Log it in the Daily tab, and watch how it moves the rest of your numbers.",
  },
  {
    id: "wealth_swaps",
    pillar: "wealth",
    title: "Cheap swaps, big reach",
    script:
      "The best changes are often the cheapest. Reheating food in glass instead of plastic. Taking shoes off at the door. Choosing fragrance-free laundry detergent. " +
      "None of these cost much, and each one touches something you do every single day. " +
      "Rank your options by how often you do the thing and how easy the swap is, not by how impressive the product sounds.",
  },
  {
    id: "wealth_leverage",
    pillar: "wealth",
    title: "Spend where it counts",
    script:
      "A few purchases have real leverage. A basic water filter. A fresh furnace filter every few months. A radon test kit, which costs about the price of a lunch and checks something you cannot see. " +
      "Skip anything that promises to detox you. The money is better spent on the boring basics, and on the time you give yourself to rest.",
  },
  {
    id: "wealth_compounding",
    pillar: "wealth",
    title: "Small habits compound",
    script:
      "Energy and health are assets you draw on every day. Small, repeated habits compound like interest: a walk, a glass of water, an earlier night. " +
      "No single day changes much, but months of them change a lot. Protecting your ability to feel good and do what you want is one of the best long-term investments you can make.",
  },
  {
    id: "purpose_why",
    pillar: "purpose",
    title: "Start with your why",
    script:
      "Awareness only matters if it serves something you care about. Maybe it is keeping up with your kids, staying strong as you age, or simply feeling clear-headed. " +
      "Take a moment and name your reason. When a habit feels like a chore, your reason is what makes it worth doing.",
  },
  {
    id: "purpose_calm",
    pillar: "purpose",
    title: "Calm, not perfect",
    script:
      "You cannot remove every exposure, and you do not need to. Chasing perfection tends to create anxiety, which is its own kind of load on the body. " +
      "Pick one small change, make it a habit, and then choose the next. If tracking ever starts to feel stressful, ease off. Steady beats intense.",
  },
  {
    id: "purpose_ripple",
    pillar: "purpose",
    title: "Leave the room better",
    script:
      "Many of these choices are shared: the air in your home, the food at the table, the products in the bathroom. " +
      "When you improve them, you improve them for everyone who lives there. Small changes you model can quietly spread to the people around you, and that is a legacy worth building.",
  },
];

export function lessonsFor(pillar: PillarKey): Lesson[] {
  return LESSONS.filter((l) => l.pillar === pillar);
}

export function estimateMinutes(script: string): number {
  return Math.max(1, Math.round(script.split(/\s+/).length / 150));
}
