/**
 * The places lens: the catalog (every check is a comparison with a real reference), reading answers as of a day, the household
 * and time weighting, and the standing exposure a place carries into advice.
 */
import { PLACE_CHECKS, CURATED, checkById, checksFor } from "../../data/placeChecks";
import { loadHazardDb } from "../scoring";
import { FRESH_DAYS, amplification, answerAge, answerAsOf, answerFreshness, countReadings, householdNotes, needsRecheck, nextChecks, peopleIn, placesStanding, readPlace, readPlaces, timeFactor } from "./evaluate";
import { PLACE_INFO, PLACE_KINDS, type Occupant, type Place, type PlaceKind } from "./types";
import { baseProfile } from "../signals/fixtures";

const substances = loadHazardDb();
const byId = new Map(substances.map((s) => [s.id, s]));

const person = (o: Partial<Occupant> = {}): Occupant => ({ id: "p1", label: "Someone", ageYears: null, pregnant: false, conditions: [], isPet: false, ...o });
const place = (kind: PlaceKind, answers: Record<string, [string, string][]> = {}, extra: Partial<Place> = {}): Place => ({
  id: `${kind}-1`, kind, label: PLACE_INFO[kind].label, hoursPerWeek: null, occupants: [], updatedAt: "2026-01-01T00:00:00.000Z",
  answers: Object.fromEntries(Object.entries(answers).map(([id, list]) => [id, list.map(([value, day]) => ({ value, day }))])), ...extra,
});

describe("the catalog: every check is a comparison with a reference", () => {
  test("ids are unique and every kind of place has a real checklist", () => {
    expect(new Set(PLACE_CHECKS.map((c) => c.id)).size).toBe(PLACE_CHECKS.length);
    for (const kind of PLACE_KINDS) expect(checksFor(kind).length).toBeGreaterThanOrEqual(3);
    expect(checksFor("home").length).toBeGreaterThanOrEqual(10);
  });

  test("each check names its reference and where it comes from, and the source is an authority or says it is the app's own", () => {
    for (const c of PLACE_CHECKS) {
      expect(c.reference.text.length).toBeGreaterThan(20);
      expect(c.reference.source.length).toBeGreaterThan(5);
      expect(/US EPA|WHO|Surgeon General/.test(c.reference.source) || c.reference.source === CURATED).toBe(true);
      expect(checkById(c.id)).toBe(c);
    }
  });

  test("options are well formed: something meets the reference, values are unique, only concerns carry a standing", () => {
    for (const c of PLACE_CHECKS) {
      expect(c.options.length).toBeGreaterThanOrEqual(3);
      expect(new Set(c.options.map((o) => o.value)).size).toBe(c.options.length);
      expect(c.options.some((o) => o.status === "meets")).toBe(true);
      expect(c.options.some((o) => o.status === "attention")).toBe(true);
      for (const o of c.options) {
        expect(o.value).not.toBe("");
        if (o.status === "attention") {
          expect(o.standing).toBeGreaterThan(0);
          expect(o.standing).toBeLessThanOrEqual(1);
        } else {
          expect(o.standing).toBeUndefined();
        }
      }
    }
  });

  test("every substance a check points at exists, and has tips to offer when an answer is worth attention", () => {
    for (const c of PLACE_CHECKS) {
      const ids = new Set([c.substanceId, ...c.options.map((o) => o.substanceId).filter((x): x is string => !!x)]);
      for (const id of ids) {
        const s = byId.get(id);
        expect(s).toBeDefined();
        expect((s!.mitigation_tips ?? []).length).toBeGreaterThan(0);
      }
    }
  });

  test("the wording is calm: no fear vocabulary in questions, answers or reasons", () => {
    const words = /\b(risk|risks|risky|danger|dangerous|toxic|unsafe|bad|fail|failing|worse|deadly|poison|poisonous|harmful)\b/i;
    for (const c of PLACE_CHECKS) {
      for (const text of [c.question, c.help ?? "", c.why, c.short, ...c.options.map((o) => o.label)]) expect(text).not.toMatch(words);
    }
  });

  test("a check applies only to the kinds of place it names", () => {
    for (const c of PLACE_CHECKS) for (const kind of PLACE_KINDS) expect(checksFor(kind).includes(c)).toBe(c.places.includes(kind));
  });
});

describe("reading a place", () => {
  test("nothing answered is unknown, never a failure: one reading per check that applies", () => {
    const r = readPlace(place("home"), "2026-09-25");
    expect(r).toHaveLength(checksFor("home").length);
    expect(r.every((x) => x.status === "unknown" && x.standing === 0 && x.day === null && x.answerLabel === null)).toBe(true);
  });

  test("an answer is read against its option: meets, attention with its standing, and the substance", () => {
    const r = readPlace(place("home", { home_gas: [["gas_none", "2026-09-01"]], home_radon: [["low", "2026-09-01"]], home_humidity: [["low", "2026-09-01"]] }), "2026-09-25");
    const gas = r.find((x) => x.checkId === "home_gas")!;
    expect(gas.status).toBe("attention");
    expect(gas.standing).toBe(1);
    expect(gas.substanceId).toBe("nitrogen_dioxide_gas_stove");
    expect(r.find((x) => x.checkId === "home_radon")!.status).toBe("meets");
    expect(r.find((x) => x.checkId === "home_radon")!.standing).toBe(0);
    // an answer can point at a different substance than the check's own: too dry is not the same as too damp
    expect(r.find((x) => x.checkId === "home_humidity")!.substanceId).toBe("low_humidity_dry_air");
  });

  test("answers are dated: the answer in force on a day is the newest one given on or before it", () => {
    const p = place("home", { home_gas: [["gas_none", "2026-06-01"], ["gas_vented", "2026-09-10"]] });
    expect(answerAsOf(p, "home_gas", "2026-05-31")).toBeNull();
    expect(answerAsOf(p, "home_gas", "2026-06-01")!.value).toBe("gas_none");
    expect(answerAsOf(p, "home_gas", "2026-09-09")!.value).toBe("gas_none");
    expect(answerAsOf(p, "home_gas", "2026-09-10")!.value).toBe("gas_vented");
    expect(readPlace(p, "2026-08-01").find((x) => x.checkId === "home_gas")!.status).toBe("attention");
    expect(readPlace(p, "2026-09-25").find((x) => x.checkId === "home_gas")!.status).toBe("meets");
  });

  test("an answer the catalog no longer offers, or one that was cleared, reads as unknown", () => {
    const stale = place("home", { home_gas: [["a_retired_option", "2026-09-01"]], home_radon: [["low", "2026-08-01"], ["", "2026-09-01"]] });
    const r = readPlace(stale, "2026-09-25");
    expect(r.find((x) => x.checkId === "home_gas")!.status).toBe("unknown");
    expect(r.find((x) => x.checkId === "home_radon")!.status).toBe("unknown");
    expect(readPlace(stale, "2026-08-15").find((x) => x.checkId === "home_radon")!.status).toBe("meets"); // the earlier answer still stands for earlier days
  });

  test("'doesn't apply' answers take a check off the table without counting for or against", () => {
    const r = readPlace(place("home", { home_filter: [["none", "2026-09-01"]] }), "2026-09-25");
    const filter = r.find((x) => x.checkId === "home_filter")!;
    expect(filter.status).toBe("na");
    expect(filter.standing).toBe(0);
    const c = countReadings(r);
    expect(c.na).toBe(1);
    expect(c.answered).toBe(1);
    expect(c.meets + c.attention).toBe(0);
  });

  test("counts: meets, attention, and how much is still unknown", () => {
    const p = place("home", { home_gas: [["electric", "2026-09-01"]], home_moisture: [["ongoing", "2026-09-01"]], home_dust: [["both", "2026-09-01"]] });
    const c = countReadings(readPlaces([p, place("work", { work_new: [["fresh", "2026-09-01"]] })], "2026-09-25"));
    expect(c.meets).toBe(2);
    expect(c.attention).toBe(2);
    expect(c.answered).toBe(4);
    expect(c.total).toBe(checksFor("home").length + checksFor("work").length);
  });

  test("freshness: a year is fully fresh, after that answers carry less, never less than 40%", () => {
    expect(answerFreshness(0)).toBe(1);
    expect(answerFreshness(FRESH_DAYS)).toBe(1);
    expect(answerFreshness(FRESH_DAYS + 100)).toBeLessThan(1);
    expect(answerFreshness(FRESH_DAYS + 100)).toBeGreaterThan(0.4);
    expect(answerFreshness(5000)).toBe(0.4);
    const r = readPlace(place("home", { home_gas: [["electric", "2025-01-01"]] }), "2026-09-25").find((x) => x.checkId === "home_gas")!;
    expect(answerAge(r, "2026-09-25")).toBe(632);
    expect(answerAge(readPlace(place("home"), "2026-09-25")[0], "2026-09-25")).toBeNull();
  });
});

describe("time and people", () => {
  test("hours a week set how much a place's findings count: 40 hours is 1, bounded", () => {
    expect(timeFactor(place("work"))).toBe(1);
    expect(timeFactor(place("home"))).toBe(2);
    expect(timeFactor(place("daily"))).toBe(0.25);
    expect(timeFactor(place("work", {}, { hoursPerWeek: 20 }))).toBe(0.5);
    expect(timeFactor(place("work", {}, { hoursPerWeek: 0 }))).toBe(0.25);
    expect(timeFactor(place("home", {}, { hoursPerWeek: 168 }))).toBe(2);
    for (const kind of PLACE_KINDS) for (const p of PLACE_INFO[kind].hourPresets) expect(p.hours).toBeGreaterThan(0);
  });

  test("the household lens reuses the personalization rules: it names who a substance matters most for, and why", () => {
    const pm = byId.get("pm25_particulate")!;
    const notes = householdNotes(pm, [person({ id: "a", label: "Priya", conditions: ["asthma"] }), person({ id: "b", label: "Sam", ageYears: 34 })]);
    expect(notes.map((n) => n.who)).toEqual(["Priya"]);
    expect(notes[0].reasons[0].label).toMatch(/asthma/i);
  });

  test("a child in the home is seen through the child rules; a pet through its own notes", () => {
    expect(householdNotes(byId.get("pm25_particulate")!, [person({ ageYears: 4 })]).length).toBe(1);
    const dust = householdNotes(byId.get("household_dust_reservoir")!, [person({ label: "Miso", isPet: true })]);
    expect(dust[0].who).toBe("Miso");
    expect(dust[0].reasons[0].label).toBe("Pet");
    expect(householdNotes(byId.get("radon")!, [person({ label: "Miso", isPet: true })])).toEqual([]);
  });

  test("a finding counts up to 75% more when it matters especially to people who share the place", () => {
    const pm = byId.get("pm25_particulate")!;
    expect(amplification(pm, [])).toBe(1);
    expect(amplification(pm, [person({ conditions: ["asthma"] })])).toBe(1.25);
    expect(amplification(pm, [person({ id: "1", conditions: ["asthma"] }), person({ id: "2", ageYears: 5 })])).toBe(1.5);
    const crowd = Array.from({ length: 6 }, (_, i) => person({ id: `${i}`, conditions: ["asthma"] }));
    expect(amplification(pm, crowd)).toBe(1.75);
  });

  test("the user is one of the people in every place, through their own profile", () => {
    const home = place("home", {}, { occupants: [person({ label: "Sam" })] });
    expect(peopleIn(home, null).map((p) => p.label)).toEqual(["Sam"]);
    expect(peopleIn(home, { ...baseProfile, conditions: ["asthma"] }).map((p) => p.label)).toEqual(["You", "Sam"]);
    expect(amplification(byId.get("pm25_particulate")!, peopleIn(home, { ...baseProfile, conditions: ["asthma"] }))).toBe(1.25);
  });
});

describe("standing exposure: what a place carries week after week", () => {
  const asOf = "2026-09-25";
  const home = (answers: Record<string, [string, string][]>, extra: Partial<Place> = {}) => place("home", answers, extra);

  test("only findings worth attention become standing exposure; a check that meets its reference adds nothing", () => {
    const st = placesStanding([home({ home_gas: [["gas_none", "2026-09-01"]], home_radon: [["low", "2026-09-01"]] })], substances, asOf, null);
    expect(st.map((s) => s.substanceId)).toEqual(["nitrogen_dioxide_gas_stove"]);
    expect(st[0].origin).toBe("places");
    expect(st[0].via).toEqual([]);
    expect(st[0].viaPlaces).toEqual(["Home: gas cooking"]);
  });

  test("the weight scales with how much of the concern the answer leaves in place, and with the hours spent there", () => {
    const w = (value: string, hours: number | null = null) => placesStanding([home({ home_gas: [[value, "2026-09-01"]] }, { hoursPerWeek: hours })], substances, asOf, null)[0]?.weight ?? 0;
    expect(w("gas_none")).toBeGreaterThan(w("gas_some"));
    expect(w("gas_some")).toBeCloseTo(w("gas_none") / 2, 5);
    expect(w("gas_none", 20)).toBeCloseTo(w("gas_none", 40) / 2, 5);
    expect(w("gas_none", 100)).toBeGreaterThan(w("gas_none", 40));
    expect(w("electric")).toBe(0);
  });

  test("who shares the place changes the weight: an asthmatic housemate makes particle findings count for more", () => {
    const answers = { home_smoke: [["indoors", "2026-09-01"]] as [string, string][] };
    const alone = placesStanding([home(answers)], substances, asOf, null)[0].weight;
    const shared = placesStanding([home(answers, { occupants: [person({ label: "Priya", conditions: ["asthma"] })] })], substances, asOf, null)[0].weight;
    expect(shared).toBeCloseTo(alone * 1.25, 1);
  });

  test("two findings about one substance in two places are one line of advice, adding their weights, naming both places", () => {
    const st = placesStanding([home({ home_smoke: [["indoors", "2026-09-01"]] }), place("daily", { daily_traffic: [["lots", "2026-09-01"]] })], substances, asOf, null);
    expect(st).toHaveLength(1);
    expect(st[0].substanceId).toBe("pm25_particulate");
    expect(st[0].viaPlaces).toHaveLength(2);
    expect(st[0].viaPlaces!.some((v) => v.startsWith("Home:"))).toBe(true);
    expect(st[0].viaPlaces!.some((v) => v.startsWith("Everyday places:"))).toBe(true);
  });

  test("the weight of one substance is capped, so no single place drowns everything else", () => {
    const crowd = Array.from({ length: 6 }, (_, i) => person({ id: `${i}`, conditions: ["asthma"] }));
    const st = placesStanding([home({ home_smoke: [["indoors", "2026-09-01"]] }, { hoursPerWeek: 168, occupants: crowd })], substances, asOf, null);
    expect(st[0].weight).toBeLessThanOrEqual(12);
  });

  test("standing follows the answer in force on the day: fixing something takes it off the list", () => {
    const p = home({ home_gas: [["gas_none", "2026-06-01"], ["gas_vented", "2026-09-10"]] });
    expect(placesStanding([p], substances, "2026-08-01", null)).toHaveLength(1);
    expect(placesStanding([p], substances, asOf, null)).toHaveLength(0);
  });

  test("a substance the database no longer has is skipped rather than crashing", () => {
    expect(placesStanding([home({ home_gas: [["gas_none", "2026-09-01"]] })], [], asOf, null)).toEqual([]);
  });
});

describe("what to ask next", () => {
  const asOf = "2026-09-25";
  test("things not yet known come first, ranked by how much they would count; then answers over a year old", () => {
    const p = place("home", { home_gas: [["electric", "2024-01-01"]] });
    const next = nextChecks([p], substances, asOf, null, 50);
    const firstStale = next.findIndex((n) => n.reason === "stale");
    expect(firstStale).toBeGreaterThan(0);
    expect(next.slice(0, firstStale).every((n) => n.reason === "unanswered")).toBe(true);
    for (let i = 1; i < firstStale; i++) expect(next[i - 1].weight).toBeGreaterThanOrEqual(next[i].weight);
    expect(next[firstStale].check.id).toBe("home_gas");
  });

  test("a check answered 'not sure' (or taken back) is not asked again for a month", () => {
    const p = place("home", { home_radon: [["unsure", "2026-09-10"]], home_humidity: [["unsure", "2026-08-01"]], home_lead: [["low", "2026-09-01"], ["", "2026-09-20"]] });
    const asked = nextChecks([p], substances, asOf, null, 50).map((n) => n.check.id);
    expect(asked).not.toContain("home_radon"); // 15 days ago
    expect(asked).not.toContain("home_lead"); // took the answer back 5 days ago
    expect(asked).toContain("home_humidity"); // 55 days ago: fair to ask again
    expect(asked).toContain("home_gas"); // never asked
  });

  test("a tip marked done since the answer was given asks 'has this changed?' first -- and only until the answer is updated", () => {
    const p = place("home", { home_gas: [["gas_none", "2026-09-01"]], home_radon: [["never", "2026-09-01"]] });
    const completedOn = { nitrogen_dioxide_gas_stove: "2026-09-10" };
    const [first] = nextChecks([p], substances, asOf, null, 3, completedOn);
    expect(first.check.id).toBe("home_gas");
    expect(first.reason).toBe("recheck");
    expect(nextChecks([p], substances, asOf, null, 50, completedOn).filter((n) => n.reason === "recheck")).toHaveLength(1);
    // answered again after acting (even with the same answer): the question is closed
    const updated = place("home", { home_gas: [["gas_none", "2026-09-01"], ["gas_none", "2026-09-12"]] });
    expect(nextChecks([updated], substances, asOf, null, 50, completedOn).some((n) => n.reason === "recheck")).toBe(false);
    // and a tip about something that is not a finding here changes nothing
    expect(nextChecks([p], substances, asOf, null, 50, { pfas: "2026-09-10" }).some((n) => n.reason === "recheck")).toBe(false);
  });

  test("needsRecheck: only findings worth attention, only when the completion came after the answer", () => {
    const reading = (status: "meets" | "attention", day: string) => ({ ...readPlace(place("home", { home_gas: [[status === "meets" ? "electric" : "gas_none", day]] }), asOf).find((r) => r.checkId === "home_gas")! });
    expect(needsRecheck(reading("attention", "2026-09-01"), { nitrogen_dioxide_gas_stove: "2026-09-02" })).toBe(true);
    expect(needsRecheck(reading("attention", "2026-09-02"), { nitrogen_dioxide_gas_stove: "2026-09-02" })).toBe(false);
    expect(needsRecheck(reading("meets", "2026-09-01"), { nitrogen_dioxide_gas_stove: "2026-09-02" })).toBe(false);
    expect(needsRecheck(reading("attention", "2026-09-01"), {})).toBe(false);
  });

  test("a fully answered, fresh place has nothing left to ask; the limit is honoured", () => {
    const answers: Record<string, [string, string][]> = {};
    for (const c of checksFor("daily")) answers[c.id] = [[c.options.find((o) => o.status === "meets")!.value, "2026-09-01"]];
    expect(nextChecks([place("daily", answers)], substances, asOf, null)).toEqual([]);
    expect(nextChecks([place("home")], substances, asOf, null, 2)).toHaveLength(2);
  });

  test("hours and housemates change the order: what matters more here is asked first", () => {
    const withAsthma = place("home", {}, { occupants: [person({ conditions: ["asthma"] })] });
    const first = nextChecks([withAsthma], substances, asOf, null, 3).map((n) => n.check.substanceId);
    expect(first.length).toBe(3);
    const solo = nextChecks([place("home")], substances, asOf, null, 30).find((n) => n.check.substanceId === "pm25_particulate")!;
    const shared = nextChecks([withAsthma], substances, asOf, null, 30).find((n) => n.check.substanceId === "pm25_particulate")!;
    expect(shared.weight).toBeGreaterThan(solo.weight);
  });
});
