/**
 * The checklist behind the Places lens. Each check asks one plain question about a place, offers a few answers, and says
 * which answers meet a published reference and which are worth attention -- so an answer is always a comparison, never
 * just a note. Every check points at an engine substance, which supplies the tips and the studies behind them.
 *
 * References were read from the authorities' own pages on 2026-09-26 (EPA: radon action level, sources of lead, moisture
 * and mold guidance, indoor air quality, air-cleaner/filter guide; WHO 2021 PM2.5 guideline and the US Surgeon General's
 * 2006 secondhand-smoke report via data/guidelines.ts). Where the standard is this app's own curated guidance rather than
 * an authority's number, the source says so. The well-water, carbon monoxide and work checks (added 2026-09-28) use the
 * app's curated guidance, backed by the PubMed studies on their substances, until the authorities' pages are re-read.
 *
 * Tone: calm and practical. A check that "needs attention" is one where a small, specific change would bring an
 * answer in line with the reference -- never a verdict about the person or the place.
 */
import type { PlaceCheck } from "../engine/places/types";

/** Marks a comparison the app makes from its own curated guidance, where no authority publishes a number. */
export const CURATED = "This app's curated guidance (see Learn for the studies behind it)";
const EPA_MOLD = "US EPA, A Brief Guide to Mold, Moisture and Your Home";

const vocOptions = (labels: { none: string; aired: string; fresh: string }) => [
  { value: "none", label: labels.none, status: "meets" as const },
  { value: "aired", label: labels.aired, status: "meets" as const },
  { value: "fresh", label: labels.fresh, status: "attention" as const, standing: 1 },
];

export const PLACE_CHECKS: PlaceCheck[] = [
  // ---------------------------------------------------------------- home
  {
    id: "home_radon", places: ["home"], short: "radon", substanceId: "radon",
    question: "Has your home been tested for radon?",
    help: "A short-term test kit is inexpensive and can be bought online or at a hardware store; results are in pCi/L.",
    options: [
      { value: "low", label: "Yes -- under 2 pCi/L", status: "meets" },
      { value: "mid", label: "Yes -- between 2 and 4 pCi/L", status: "attention", standing: 0.5 },
      { value: "high", label: "Yes -- 4 pCi/L or more, not yet fixed", status: "attention", standing: 1 },
      { value: "fixed", label: "It was high and has been fixed", status: "meets" },
      { value: "never", label: "Never tested", status: "attention", standing: 0.6 },
      { value: "unsure", label: "Not sure", status: "unknown" },
    ],
    reference: { text: "EPA recommends fixing a home at 4 pCi/L or more and considering it between 2 and 4; every home should be tested.", source: "US EPA, radon action level and guide" },
    why: "Radon is a natural gas that can collect indoors. You can't see or smell it, and a simple test tells you exactly where your home stands.",
  },
  {
    id: "home_lead", places: ["home"], short: "older paint and pipes", substanceId: "lead_exposure",
    question: "When was your home built, and has it been checked for lead?",
    help: "Homes built before 1978 more often have lead-based paint (it matters most when chipping or being renovated); before 1986, lead pipes or solder. A paint or water test, or a check by a certified inspector, settles it.",
    options: [
      { value: "new", label: "1986 or later", status: "meets" },
      { value: "checked", label: "Older than that -- and the paint or water has been tested, or it was checked when I bought or renovated", status: "meets" },
      { value: "mid", label: "1978 to 1985, not checked", status: "attention", standing: 0.3 },
      { value: "old", label: "Before 1978, not checked", status: "attention", standing: 0.7 },
      { value: "unsure", label: "Not sure", status: "unknown" },
    ],
    reference: { text: "Homes built before 1978 are more likely to have lead-based paint; lead pipes are more likely in homes built before 1986.", source: "US EPA, protect your family from sources of lead" },
    why: "Older paint and plumbing can carry lead. It matters most for young children and during renovation, and a test tells you whether it applies to your home.",
  },
  {
    id: "home_gas", places: ["home"], short: "gas cooking", substanceId: "nitrogen_dioxide_gas_stove",
    question: "How do you cook at home?",
    options: [
      { value: "electric", label: "Electric or induction", status: "meets" },
      { value: "gas_vented", label: "Gas or propane -- and I run a hood vented outdoors (or open a window) every time", status: "meets" },
      { value: "gas_some", label: "Gas or propane -- and I sometimes ventilate", status: "attention", standing: 0.5 },
      { value: "gas_none", label: "Gas or propane -- and I usually don't ventilate", status: "attention", standing: 1 },
    ],
    reference: { text: "Vent appliances that produce moisture, such as stoves, to the outside where possible; kitchen fans that exhaust outdoors remove contaminants directly from the room.", source: "US EPA, A Brief Guide to Mold, Moisture and Your Home; Improving Indoor Air Quality" },
    why: "A gas flame releases nitrogen dioxide into the room. Ventilating while you cook takes most of it straight out.",
  },
  {
    id: "home_moisture", places: ["home"], short: "damp or mold", substanceId: "mold_indoor",
    question: "In the last year, has anywhere in your home had water damage, visible mold or a musty smell?",
    options: [
      { value: "none", label: "No", status: "meets" },
      { value: "fixed", label: "Yes -- and it was dried out and fixed quickly", status: "meets" },
      { value: "slow", label: "Yes -- and it took more than a couple of days to dry", status: "attention", standing: 0.6 },
      { value: "ongoing", label: "Yes -- and it's still there or keeps coming back", status: "attention", standing: 1 },
    ],
    reference: { text: "Dry water-damaged areas and items within 24-48 hours to prevent mold growth.", source: EPA_MOLD },
    why: "Damp is what mold needs. Drying things quickly, and fixing where the water comes from, is what keeps it away.",
  },
  {
    id: "home_humidity", places: ["home"], short: "indoor humidity", substanceId: "high_humidity",
    question: "What is the humidity indoors?",
    help: "A hygrometer costs about ten dollars and shows relative humidity at a glance.",
    options: [
      { value: "ok", label: "30 to 50%", status: "meets" },
      { value: "mid", label: "50 to 60%", status: "attention", standing: 0.4, substanceId: "high_humidity" },
      { value: "high", label: "Above 60%", status: "attention", standing: 1, substanceId: "high_humidity" },
      { value: "low", label: "Below 30%", status: "attention", standing: 0.6, substanceId: "low_humidity_dry_air" },
      { value: "unsure", label: "I haven't measured it", status: "unknown" },
    ],
    reference: { text: "Keep indoor humidity below 60 percent, ideally between 30 and 50 percent.", source: EPA_MOLD },
    why: "Air that's too damp helps mold grow; air that's too dry can irritate eyes, nose and throat. The middle is comfortable and hardest for either to take hold.",
  },
  {
    id: "home_filter", places: ["home"], short: "heating and cooling filter", substanceId: "hvac_filter_age",
    question: "When was your heating or cooling filter last changed?",
    options: [
      { value: "recent", label: "Within the last 3 months", status: "meets" },
      { value: "mid", label: "3 to 6 months ago", status: "attention", standing: 0.5 },
      { value: "old", label: "More than 6 months ago, or never", status: "attention", standing: 1 },
      { value: "none", label: "I don't have a central system or filter", status: "na" },
      { value: "unsure", label: "Not sure", status: "unknown" },
    ],
    reference: { text: "Manufacturers typically recommend replacing filters every 60 to 90 days, sooner if they look heavily soiled.", source: "US EPA, Guide to Air Cleaners in the Home" },
    why: "A clogged filter stops filtering and can restrict airflow. Putting the date on the new one when you change it makes the next change easy to remember.",
  },
  {
    id: "home_scents", places: ["home"], short: "candles, incense and air fresheners", substanceId: "candle_incense_pm",
    question: "How often do you burn candles or incense, or use scented plug-ins and air fresheners?",
    options: [
      { value: "rare", label: "Rarely or never", status: "meets" },
      { value: "some", label: "A few times a week", status: "attention", standing: 0.5 },
      { value: "daily", label: "Most days", status: "attention", standing: 1 },
    ],
    reference: { text: "Crack a window or run an exhaust fan when burning candles or incense; reserve daily ambiance for flameless candles.", source: CURATED },
    why: "Burning and scent products add fine particles and fragrance chemicals to the air you breathe indoors; a cracked window while they're on takes most of the edge off.",
  },
  {
    id: "home_laundry", places: ["home"], short: "laundry fragrance", substanceId: "fragranced_laundry_products",
    question: "Do you use fragranced laundry products (dryer sheets, scent boosters, scented detergent)?",
    options: [
      { value: "free", label: "No -- fragrance-free", status: "meets" },
      { value: "some", label: "Sometimes", status: "attention", standing: 0.5 },
      { value: "regular", label: "Regularly", status: "attention", standing: 1 },
    ],
    reference: { text: "Fragrance-free detergent is widely available at the same price and cleans equally well; wool dryer balls replace dryer sheets.", source: CURATED },
    why: "Laundry fragrance travels with your clothes and bedding all day and night. Fragrance-free costs the same and cleans the same.",
  },
  {
    id: "home_voc", places: ["home"], short: "new paint, carpet or furniture", substanceId: "voc_off_gassing",
    question: "Anything new at home in the last six months -- paint, carpet, furniture, or a renovation?",
    options: vocOptions({ none: "No", aired: "Yes -- and I aired it out or chose low-VOC products", fresh: "Yes -- and it hasn't been well ventilated" }),
    reference: { text: "Ventilate well after painting or installing new furniture or carpet (days to weeks); choose low-VOC products where possible.", source: CURATED },
    why: "New paint, carpet and furniture release fumes for days to weeks. Fresh air while it settles is most of the fix.",
  },
  {
    id: "home_dust", places: ["home"], short: "floor dust", substanceId: "household_dust_reservoir",
    question: "Do you leave shoes at the door, and vacuum with a HEPA filter or damp-mop most weeks?",
    options: [
      { value: "both", label: "Both, most weeks", status: "meets" },
      { value: "one", label: "One of the two", status: "attention", standing: 0.5 },
      { value: "neither", label: "Neither", status: "attention", standing: 1 },
    ],
    reference: { text: "Vacuum with a HEPA-filter vacuum weekly; wet-mop hard floors rather than dry-dusting; shoes off at the door.", source: CURATED },
    why: "Dust is where many household chemicals end up, and floor dust is what small children touch and put in their mouths most.",
  },
  {
    id: "home_lawn", places: ["home"], short: "lawn and garden treatments", substanceId: "lawn_pesticide_tracked_in",
    question: "Is the lawn or garden treated with pesticides or weed killer (by you, a landlord or a service)?",
    options: [
      { value: "no", label: "No, or I don't have one", status: "meets" },
      { value: "some", label: "Sometimes", status: "attention", standing: 0.5 },
      { value: "regular", label: "Regularly", status: "attention", standing: 1 },
    ],
    reference: { text: "Shoes off at the door is the most effective low-cost step; wipe pet paws after treated grass; keep kids and pets off treated areas for the label's re-entry interval.", source: CURATED },
    why: "Treated grass gets carried indoors on shoes and paws. Leaving shoes at the door is the biggest single fix.",
  },
  {
    id: "home_nonstick", places: ["home"], short: "nonstick cookware", substanceId: "nonstick_cookware_ptfe",
    question: "Do you cook on nonstick pans?",
    options: [
      { value: "no", label: "No -- cast iron, stainless steel or similar", status: "meets" },
      { value: "careful", label: "Yes -- on medium heat, and I replace scratched ones", status: "meets" },
      { value: "hot", label: "Yes -- and I preheat empty on high heat, or use scratched pans", status: "attention", standing: 1 },
    ],
    reference: { text: "Never preheat a nonstick pan empty on high heat; retire a pan once the coating is scratched, flaking or peeling.", source: CURATED },
    why: "Nonstick coatings are fine at ordinary cooking heat. The thing to avoid is overheating an empty pan or using a worn coating.",
  },
  {
    id: "home_smoke", places: ["home"], short: "smoking or vaping indoors", substanceId: "tobacco_smoke",
    question: "Does anyone smoke or vape indoors at home?",
    options: [
      { value: "no", label: "No", status: "meets" },
      { value: "outside", label: "Only outdoors", status: "meets" },
      { value: "indoors", label: "Yes -- indoors", status: "attention", standing: 1 },
    ],
    reference: { text: "Even brief exposure to secondhand smoke has measurable effects, and no level has been found without them.", source: "US Surgeon General, 2006 report" },
    why: "Smoke and vapor stay in the air and settle on surfaces. Going outside removes most of the exposure for everyone else in the home.",
  },
  {
    id: "home_water", places: ["home"], short: "well water", substanceId: "private_well_water",
    question: "Where does your home's drinking water come from?",
    help: "If you pay a water bill to a utility, it's a public system. A well on the property is private, and testing it is up to the owner.",
    options: [
      { value: "utility", label: "A public water utility", status: "meets" },
      { value: "well_tested", label: "A private well, tested by a certified lab in the last year", status: "meets" },
      { value: "well_untested", label: "A private well, not tested in the last year", status: "attention", standing: 1 },
      { value: "unsure", label: "Not sure", status: "unknown" },
    ],
    reference: { text: "Private wells are not covered by public drinking-water rules. Test at least once a year for bacteria and nitrate through a certified lab, and for arsenic at least once.", source: CURATED },
    why: "Well water can carry things you can't see or taste, such as arsenic from rock or nitrate from farm runoff. A yearly lab test is the only way to know.",
  },
  {
    id: "home_co", places: ["home"], short: "carbon monoxide alarm", substanceId: "carbon_monoxide",
    question: "Does your home have fuel-burning appliances or an attached garage -- and a working carbon monoxide alarm?",
    help: "Fuel-burning means gas, oil, propane or wood: a furnace, water heater, gas stove, fireplace or space heater.",
    options: [
      { value: "none", label: "No fuel-burning appliances or attached garage", status: "na" },
      { value: "alarm", label: "Yes, and a working CO alarm near where we sleep", status: "meets" },
      { value: "no_alarm", label: "Yes, but no working CO alarm", status: "attention", standing: 1 },
      { value: "unsure", label: "Not sure", status: "unknown" },
    ],
    reference: { text: "A working carbon monoxide alarm near sleeping areas, and no generator or engine run indoors or in an attached garage.", source: CURATED },
    why: "Carbon monoxide has no smell or color, and early signs feel like the flu. An alarm is inexpensive and notices it before you would.",
  },
  {
    id: "home_drycleaning", places: ["home"], short: "dry-cleaned clothes", substanceId: "dry_cleaning_perc",
    question: "How often do you bring home dry-cleaned clothes?",
    options: [
      { value: "rare", label: "Rarely or never, or I use wet cleaning", status: "meets" },
      { value: "aired", label: "Sometimes -- and I air them outside first", status: "meets" },
      { value: "regular", label: "Regularly -- and I hang them straight in the closet", status: "attention", standing: 0.7 },
    ],
    reference: { text: "Remove the plastic bag and air dry-cleaned items for a few hours to a day before wearing or storing them; ask about wet cleaning.", source: CURATED },
    why: "Some dry cleaners use a solvent that lingers on fresh clothes. A few hours of airing, bag off, takes most of it away.",
  },

  // ---------------------------------------------------------------- work or school
  {
    id: "work_air", places: ["work"], short: "the air where you work", substanceId: "low_humidity_dry_air",
    question: "How does the air feel where you work?",
    options: [
      { value: "ok", label: "Comfortable", status: "meets" },
      { value: "dry", label: "Often dry (dry eyes, static)", status: "attention", standing: 0.7, substanceId: "low_humidity_dry_air" },
      { value: "stuffy", label: "Often stuffy or stale", status: "attention", standing: 0.7, substanceId: "hvac_filter_age" },
    ],
    reference: { text: "Indoor relative humidity between 30 and 50 percent is the recommended range; dry or stale air at work usually traces to the building's ventilation and filters.", source: `${EPA_MOLD}; this app's curated guidance` },
    why: "Dry or stale air at work is usually about the building's ventilation and filters -- a fair thing to raise with whoever looks after it.",
  },
  {
    id: "work_filters", places: ["work"], short: "the building's air filters", substanceId: "hvac_filter_age",
    question: "Do you know whether the building's air filters are maintained on a schedule?",
    options: [
      { value: "yes", label: "Yes", status: "meets" },
      { value: "no", label: "No, they aren't", status: "attention", standing: 0.6 },
      { value: "unsure", label: "I've never asked", status: "unknown" },
    ],
    reference: { text: "Filters typically need replacing every 60 to 90 days; ask facilities to confirm the maintenance schedule.", source: "US EPA, Guide to Air Cleaners in the Home; this app's curated guidance" },
    why: "You can't change the filters yourself, but you can ask when they were last changed -- and the question often gets them changed.",
  },
  {
    id: "work_exposures", places: ["work"], short: "dust, fumes or chemicals at work", substanceId: "work_dust_fumes",
    question: "Does your work involve dust, fumes, solvents, pesticides or other chemicals?",
    help: "Think of the tasks as well as the place: sanding, welding, spraying, cutting stone or concrete, strong cleaning products, farm or lawn chemicals.",
    options: [
      { value: "no", label: "No", status: "meets" },
      { value: "controlled", label: "Yes -- with ventilation or enclosures, and I can see the safety data sheets", status: "meets" },
      { value: "partly", label: "Yes -- some controls, but I mostly rely on a mask", status: "attention", standing: 0.5 },
      { value: "uncontrolled", label: "Yes -- with little or no protection", status: "attention", standing: 1 },
      { value: "unsure", label: "Not sure", status: "unknown" },
    ],
    reference: { text: "Controls that remove or enclose the source come first, then ventilation, with masks last; each product's safety data sheet lists what it contains and the protection it needs.", source: CURATED },
    why: "Work is often where the highest levels of anything in your day come from. Asking for the safety data sheets is a fair, ordinary request.",
  },
  {
    id: "work_new", places: ["work"], short: "new paint, carpet or furniture at work", substanceId: "voc_off_gassing",
    question: "Anything new where you work in the last six months -- paint, carpet, furniture, or a renovation?",
    options: vocOptions({ none: "No", aired: "Yes -- and it was aired out first", fresh: "Yes -- and I sit in it, unventilated" }),
    reference: { text: "Ventilate well after painting or installing new furniture or carpet (days to weeks).", source: CURATED },
    why: "New finishes release fumes for days to weeks. If you can open a window or move for a few days, that's most of the answer.",
  },
  {
    id: "work_moisture", places: ["work"], short: "damp or mold at work", substanceId: "mold_indoor",
    question: "Any water damage, visible mold or musty smell in your workspace?",
    options: [
      { value: "none", label: "No", status: "meets" },
      { value: "fixed", label: "Yes -- and it was dealt with quickly", status: "meets" },
      { value: "ongoing", label: "Yes -- and it's still there", status: "attention", standing: 1 },
    ],
    reference: { text: "Dry water-damaged areas and items within 24-48 hours to prevent mold growth.", source: EPA_MOLD },
    why: "If it's in a building you don't control, reporting it in writing is the usual first step.",
  },
  {
    id: "work_ground", places: ["work"], short: "radon at ground level", substanceId: "radon",
    question: "Is your workspace in a basement or on the ground floor?",
    options: [
      { value: "no", label: "No -- upper floors", status: "na" },
      { value: "tested", label: "Yes -- and the space has been tested (or fixed)", status: "meets" },
      { value: "untested", label: "Yes -- and it hasn't been tested", status: "attention", standing: 0.6 },
      { value: "unsure", label: "Not sure", status: "unknown" },
    ],
    reference: { text: "Radon collects in basements and ground-floor rooms; EPA's action level is 4 pCi/L. The guidance is written for homes, but the physics is the same.", source: "US EPA, radon action level; this app's curated guidance" },
    why: "Radon comes up from the ground, so it collects in low rooms. If you spend long hours at ground level, it's worth asking whether the space was ever tested.",
  },

  // ---------------------------------------------------------------- everyday places
  {
    id: "daily_traffic", places: ["daily"], short: "time in heavy traffic", substanceId: "pm25_particulate",
    question: "How much of your week is spent in or beside heavy traffic -- driving, on the bus, cycling or walking beside busy roads?",
    options: [
      { value: "little", label: "Little or none", status: "meets" },
      { value: "some", label: "A few hours a week", status: "attention", standing: 0.5 },
      { value: "lots", label: "Most days", status: "attention", standing: 1 },
      { value: "steps", label: "Most days -- and I take steps: recirculated air, a quieter route, or a mask at rush hour", status: "attention", standing: 0.3 },
    ],
    reference: { text: "WHO's 2021 guideline for fine particles (PM2.5) is an annual average of 5 µg/m³; busy roads are among the common local sources.", source: "WHO Global Air Quality Guidelines, 2021; this app's curated guidance" },
    why: "Fine particles are highest right beside busy roads. A route one street over, or a different hour, lowers your share without changing where you go.",
  },
  {
    id: "daily_smoke_days", places: ["daily"], short: "smoky and high-pollution days", substanceId: "pm25_particulate",
    question: "On smoky or high-pollution days, do you check the air quality and adjust?",
    options: [
      { value: "yes", label: "Yes -- I stay in, filter the air, or wear a mask outside", status: "meets" },
      { value: "rare", label: "It's rarely an issue where I live", status: "meets" },
      { value: "no", label: "No, I don't check", status: "attention", standing: 0.5 },
    ],
    reference: { text: "On high-PM2.5 days keep windows closed and run a HEPA purifier if you have one; an N95 mask reduces exposure during outdoor smoke events.", source: CURATED },
    why: "A few smoky days a year are what most people notice. Checking the air quality takes seconds, and this app can do it for you if location is on.",
  },
  {
    id: "daily_bottles", places: ["daily"], short: "plastic bottles and reheating", substanceId: "microplastics_bottled_water",
    question: "How do you carry water and reheat food?",
    options: [
      { value: "good", label: "A reusable bottle, and nothing plastic goes in the microwave", status: "meets" },
      { value: "bottles", label: "Single-use plastic bottles most days", status: "attention", standing: 0.6 },
      { value: "heat", label: "I reheat food in plastic containers", status: "attention", standing: 0.6 },
      { value: "both", label: "Both", status: "attention", standing: 1 },
    ],
    reference: { text: "A reusable stainless steel or glass bottle with filtered tap water sidesteps it; never microwave food in plastic.", source: CURATED },
    why: "Plastic sheds tiny particles when it's heated or worn. A reusable bottle and a glass or ceramic dish for reheating sidestep the question.",
  },
];

export const checkById = (id: string) => PLACE_CHECKS.find((c) => c.id === id);
export const checksFor = (kind: PlaceCheck["places"][number]) => PLACE_CHECKS.filter((c) => c.places.includes(kind));
