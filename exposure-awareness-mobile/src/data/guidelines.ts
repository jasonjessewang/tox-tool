/**
 * Verified recommendations from public-health authorities, written as one-line takeaways
 * for the loading screen. Each number was checked against the authority's own source
 * before being written here (WHO's 2021 Global Air Quality Guidelines page, CDC's blood
 * lead reference value page, the 2018 Physical Activity Guidelines for Americans, the
 * 2020-2025 Dietary Guidelines for Americans, EPA's radon guidance, and CDC's sleep
 * guidance) -- see the project notes for the exact pages used.
 */
export interface Guideline {
  id: string;
  icon: string;
  authority: string;
  year: string;
  text: string;
}

export const GUIDELINES: Guideline[] = [
  { id: "who_pm25", icon: "🌬️", authority: "World Health Organization", year: "2021", text: "WHO's air quality guideline for fine particles (PM2.5) is an annual average of 5 µg/m³ -- about 99% of people worldwide breathe air above it." },
  { id: "cdc_lead", icon: "🩸", authority: "CDC", year: "2021", text: "CDC's blood lead reference value for children is 3.5 µg/dL. There is no known safe blood lead level -- the goal is always lower, not a threshold to stay under." },
  { id: "epa_radon", icon: "⚠️", authority: "EPA", year: "2024", text: "EPA recommends fixing a home at 4 pCi/L of radon or higher -- and testing every home, since radon is invisible without a kit." },
  { id: "activity_150", icon: "🏃", authority: "US Physical Activity Guidelines", year: "2018", text: "Adults get real health benefits from at least 150 minutes a week of moderate activity, plus muscle-strengthening on 2 or more days." },
  { id: "sugar_10pct", icon: "🍬", authority: "US Dietary Guidelines", year: "2020", text: "US Dietary Guidelines recommend keeping added sugars under 10% of daily calories -- about 50g on a 2,000-calorie day." },
  { id: "sodium_2300", icon: "🧂", authority: "FDA", year: "2016", text: "FDA's Daily Value for sodium is 2,300 mg -- most people in the US eat well above it, mostly from packaged and restaurant food, not the salt shaker." },
  { id: "sleep_7", icon: "🌙", authority: "CDC / Sleep Foundation", year: "2015", text: "Adults are recommended 7 or more hours of sleep a night. Short sleep is linked to higher risk of several chronic conditions." },
  { id: "smoke_free", icon: "🚬", authority: "US Surgeon General", year: "2006", text: "There is no risk-free level of secondhand smoke exposure -- even brief exposure can have measurable cardiovascular effects." },
  { id: "handwashing", icon: "🧼", authority: "CDC", year: "2023", text: "Handwashing with soap for 20 seconds is one of the most effective, lowest-cost ways to avoid spreading infection -- roughly the time it takes to hum a short tune twice." },
  { id: "produce_wash", icon: "🥬", authority: "USDA / FDA", year: "2023", text: "Rinsing fruits and vegetables under running water measurably reduces residues and surface bacteria, even without soap or produce wash." },
];

export const guidelineToWisdomId = (g: Guideline) => `guideline_${g.id}`;
