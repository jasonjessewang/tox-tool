/**
 * Places end to end: real storage, dated answers, the household, the advice it feeds and the receipt it returns.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as db from "../../storage/db";
import { addPlace, answerCheck, clearAnswer, getPlacesOverview, getPlacesStanding, newOccupant, removeOccupant, removePlace, renamePlace, saveOccupant, setPlaceHours } from "./state";
import { getAdviceInputs, mergeStanding } from "../adviceState";
import { getWellnessScore } from "../wellnessState";
import { runActivity } from "../receipts";
import { loadHazardDb, scoreLogs } from "../scoring";
import { checksFor } from "../../data/placeChecks";
import { readPlace } from "./evaluate";
import { daysAgoISO, todayISO } from "../../util/dates";
import type { StandingExposure } from "../types";

const NOW = new Date(2026, 8, 25, 12);
const at = (n: number) => new Date(2026, 8, 25 - n, 12);

beforeAll(() => {
  jest.useFakeTimers({
    doNotFake: ["nextTick", "setImmediate", "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout", "queueMicrotask", "hrtime", "performance", "requestAnimationFrame", "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback"],
    now: NOW,
  });
});
afterAll(() => jest.useRealTimers());
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.setSystemTime(NOW);
});

const answerOf = async (placeId: string, checkId: string) => (await db.getPlaces()).find((p) => p.id === placeId)!.answers[checkId];

describe("keeping a place", () => {
  test("a new place starts empty, named for its kind, and is stored", async () => {
    const home = await addPlace("home");
    expect(home.label).toBe("Home");
    expect(home.hoursPerWeek).toBeNull();
    expect(home.occupants).toEqual([]);
    expect(Object.keys(home.answers)).toEqual([]);
    expect((await db.getPlaces()).map((p) => p.id)).toEqual([home.id]);
    expect((await addPlace("work", "  The studio ")).label).toBe("The studio");
  });

  test("a day's answer is dated; correcting it that day replaces it; a later day adds to the history, even for the same answer", async () => {
    const { id } = await addPlace("home");
    await answerCheck(id, "home_gas", "gas_none", at(30));
    await answerCheck(id, "home_gas", "gas_some", at(30));
    expect(await answerOf(id, "home_gas")).toEqual([{ value: "gas_some", day: daysAgoISO(30, NOW) }]);
    await answerCheck(id, "home_gas", "gas_some", at(0));
    expect(await answerOf(id, "home_gas")).toEqual([{ value: "gas_some", day: daysAgoISO(30, NOW) }, { value: "gas_some", day: todayISO(NOW) }]);
  });

  test("only answers the catalog offers, to checks that apply to that kind of place", async () => {
    const { id } = await addPlace("home");
    await expect(answerCheck(id, "home_gas", "warp_drive", NOW)).rejects.toThrow(/No answer/);
    await expect(answerCheck(id, "not_a_check", "x", NOW)).rejects.toThrow(/No check/);
    await expect(answerCheck(id, "work_air", "ok", NOW)).rejects.toThrow(/does not apply/);
    await expect(answerCheck("missing", "home_gas", "electric", NOW)).rejects.toThrow(/No place/);
    expect(await answerOf(id, "home_gas")).toBeUndefined();
  });

  test("clearing an answer takes it back to unknown without erasing what was true earlier", async () => {
    const { id } = await addPlace("home");
    await answerCheck(id, "home_radon", "low", at(20));
    await clearAnswer(id, "home_radon", at(0));
    const place = (await db.getPlaces())[0];
    expect(readPlace(place, todayISO(NOW)).find((r) => r.checkId === "home_radon")!.status).toBe("unknown");
    expect(readPlace(place, daysAgoISO(10, NOW)).find((r) => r.checkId === "home_radon")!.status).toBe("meets");
  });

  test("the history per check is bounded", async () => {
    const { id } = await addPlace("home");
    for (let i = 20; i >= 0; i--) await answerCheck(id, "home_gas", i % 2 ? "gas_some" : "electric", at(i));
    const list = await answerOf(id, "home_gas");
    expect(list).toHaveLength(12);
    expect(list[list.length - 1].day).toBe(todayISO(NOW));
  });

  test("many quick answers never clobber each other", async () => {
    const { id } = await addPlace("home");
    const checks = checksFor("home");
    await Promise.all(checks.map((c) => answerCheck(id, c.id, c.options.find((o) => o.status === "meets")!.value, NOW)));
    expect(Object.keys((await db.getPlaces())[0].answers)).toHaveLength(checks.length);
    await Promise.all([addPlace("work"), addPlace("daily"), setPlaceHours(id, 90), renamePlace(id, "Our flat")]);
    const places = await db.getPlaces();
    expect(places).toHaveLength(3);
    expect(places.find((p) => p.id === id)).toMatchObject({ label: "Our flat", hoursPerWeek: 90 });
  });

  test("hours are bounded and blank names are ignored; null goes back to the default for the kind", async () => {
    const { id } = await addPlace("work");
    expect((await setPlaceHours(id, 500)).hoursPerWeek).toBe(168);
    expect((await setPlaceHours(id, -4)).hoursPerWeek).toBe(0);
    expect((await setPlaceHours(id, 37.6)).hoursPerWeek).toBe(38);
    expect((await setPlaceHours(id, null)).hoursPerWeek).toBeNull();
    expect((await renamePlace(id, "   ")).label).toBe("Work or school");
  });

  test("the household: people are added, updated in place, and removed; a place can be removed with everything in it", async () => {
    const { id } = await addPlace("home");
    const priya = newOccupant({ label: "Priya", pregnant: true });
    await saveOccupant(id, priya);
    await saveOccupant(id, newOccupant({ label: "Miso", isPet: true }));
    await saveOccupant(id, { ...priya, conditions: ["asthma"] });
    let home = (await db.getPlaces())[0];
    expect(home.occupants.map((o) => o.label)).toEqual(["Priya", "Miso"]);
    expect(home.occupants[0].conditions).toEqual(["asthma"]);
    await removeOccupant(id, priya.id);
    home = (await db.getPlaces())[0];
    expect(home.occupants.map((o) => o.label)).toEqual(["Miso"]);
    await removePlace(id);
    expect(await db.getPlaces()).toEqual([]);
  });
});

test("wiping local data wipes the places too", async () => {
  const { id } = await addPlace("home");
  await answerCheck(id, "home_gas", "gas_none", NOW);
  await db.clearAll();
  expect(await db.getPlaces()).toEqual([]);
});

describe("what places feed: advice", () => {
  test("a finding worth attention becomes standing advice, with the place named and the studies of the substance behind it", async () => {
    const { id } = await addPlace("home");
    await answerCheck(id, "home_gas", "gas_none", NOW);
    await answerCheck(id, "home_radon", "low", NOW);
    const standing = await getPlacesStanding(NOW);
    expect(standing.map((s) => s.substanceId)).toEqual(["nitrogen_dioxide_gas_stove"]);

    const inputs = await getAdviceInputs(NOW);
    const report = scoreLogs({ food: [], products: [], environment: [], air_quality: [], practices: [] }, loadHazardDb(), new Set(), inputs);
    expect(report.focus_items.length).toBeGreaterThan(0);
    const top = report.focus_items[0];
    expect(top.tip_key.startsWith("nitrogen_dioxide_gas_stove:")).toBe(true);
    expect(top.origin).toBe("places");
    expect(top.viaPlaces).toEqual(["Home: gas cooking"]);
    expect(top.via).toEqual([]);
  });

  test("Focus never repeats a place's substance, however many tips it has", async () => {
    const { id } = await addPlace("home");
    await answerCheck(id, "home_gas", "gas_none", NOW);
    await answerCheck(id, "home_moisture", "ongoing", NOW);
    const inputs = await getAdviceInputs(NOW);
    const report = scoreLogs({ food: [], products: [], environment: [], air_quality: [], practices: [] }, loadHazardDb(), new Set(), inputs);
    const sources = report.focus_items.map((r) => r.tip_key.split(":")[0]);
    expect(new Set(sources).size).toBe(sources.length);
    expect(sources.length).toBe(2);
  });

  test("fixing it takes the advice away, and deciding to keep it quiets Focus like any other advice", async () => {
    const { id } = await addPlace("home");
    await answerCheck(id, "home_gas", "gas_none", at(3));
    expect((await getPlacesStanding(NOW)).length).toBe(1);
    await db.keepAdvice({ source_key: "nitrogen_dioxide_gas_stove", label: "Gas cooking", decided_date: todayISO(NOW), until: daysAgoISO(-60, NOW) });
    const inputs = await getAdviceInputs(NOW);
    expect(inputs.kept.has("nitrogen_dioxide_gas_stove")).toBe(true);
    const report = scoreLogs({ food: [], products: [], environment: [], air_quality: [], practices: [] }, loadHazardDb(), new Set(), inputs);
    expect(report.focus_items).toEqual([]);
    await answerCheck(id, "home_gas", "gas_vented", NOW);
    expect(await getPlacesStanding(NOW)).toEqual([]);
  });

  test("a substance on the shelf and in a place is one decision: weights add, both origins are remembered", () => {
    const shelf: StandingExposure[] = [{ substanceId: "fragranced_laundry_products", weight: 7, via: ["Lavender detergent"], origin: "shelf" }, { substanceId: "phthalates", weight: 4, via: ["Body lotion"] }];
    const places: StandingExposure[] = [{ substanceId: "fragranced_laundry_products", weight: 3, via: [], viaPlaces: ["Home: scented laundry products"], origin: "places" }];
    const merged = mergeStanding(shelf, places);
    expect(merged).toHaveLength(2);
    const laundry = merged.find((m) => m.substanceId === "fragranced_laundry_products")!;
    expect(laundry.weight).toBe(10);
    expect(laundry.via).toEqual(["Lavender detergent"]);
    expect(laundry.viaPlaces).toEqual(["Home: scented laundry products"]);
    expect(laundry.origin).toBe("shelf"); // the larger contributor
    expect(mergeStanding(places, shelf).find((m) => m.substanceId === "fragranced_laundry_products")!.origin).toBe("shelf");
    expect(merged.find((m) => m.substanceId === "phthalates")!.origin).toBe("shelf");
    expect(mergeStanding([], [])).toEqual([]);
  });
});

describe("what places feed: the score and its receipt", () => {
  test("a first answer turns an empty part into a first reading, compared against the reference it came from", async () => {
    const { id } = await addPlace("home");
    const { receipt } = await runActivity("place_check", () => answerCheck(id, "home_radon", "low", NOW), { now: NOW });
    expect(receipt.kind).toBe("place_check");
    expect(receipt.lines.map((l) => l.key)).toEqual(["places"]);
    expect(receipt.lines[0].before.confidence).toBe(0);
    expect(receipt.lines[0].after.confidence).toBeCloseTo(0.125, 1); // one comparison of the eight that make the picture full
    expect(receipt.lines[0].headline).toMatch(/first reading/);
    expect(receipt.lines[0].parts[0].against).toMatch(/US EPA/);
  });

  test("fixing something moves the part up, and the receipt says so", async () => {
    const { id } = await addPlace("home");
    for (const c of checksFor("home").slice(0, 8)) await answerCheck(id, c.id, c.options.find((o) => o.status === "meets")!.value, at(5));
    await answerCheck(id, "home_gas", "gas_none", at(5));
    const { receipt } = await runActivity("place_check", () => answerCheck(id, "home_gas", "gas_vented", NOW), { now: NOW });
    expect(receipt.lines[0].after.value).toBeGreaterThan(receipt.lines[0].before.value);
    expect(receipt.lines[0].headline).toMatch(/->/);
  });

  test("someone joining the household is scored too: a finding that matters more for them counts for more", async () => {
    const { id } = await addPlace("home");
    for (const c of checksFor("home").slice(0, 6)) await answerCheck(id, c.id, c.options.find((o) => o.status === "meets")!.value, at(5));
    await answerCheck(id, "home_smoke", "indoors", at(5));
    const { receipt } = await runActivity("place_context", () => saveOccupant(id, newOccupant({ label: "Priya", conditions: ["asthma"] })), { now: NOW });
    expect(receipt.kind).toBe("place_context");
    expect(receipt.lines.map((l) => l.key)).toEqual(["places"]);
    expect(receipt.lines[0].after.value).toBeLessThan(receipt.lines[0].before.value);
  });

  test("the score now carries a Places part, weighted like the others, whose coverage grows as the person fills it in", async () => {
    const empty = await getWellnessScore(undefined, NOW);
    expect(empty.components.map((c) => c.key)).toContain("places");
    expect(empty.components.find((c) => c.key === "places")!.confidence).toBe(0);
    const { id } = await addPlace("home");
    for (const c of checksFor("home").slice(0, 8)) await answerCheck(id, c.id, c.options.find((o) => o.status === "meets")!.value, NOW);
    const filled = await getWellnessScore(undefined, NOW);
    const part = filled.components.find((c) => c.key === "places")!;
    expect(part.confidence).toBe(1);
    expect(part.value).toBeGreaterThan(95); // everything meets; the value still leans a little toward a typical place
    expect(filled.coverage).toBeGreaterThanOrEqual(empty.coverage + 19);
  });
});

describe("the overview the screens read", () => {
  test("an empty person has nothing compared and nothing to ask; a person with a place has the next question", async () => {
    const empty = await getPlacesOverview(NOW);
    expect(empty.summary).toEqual({ places: 0, compared: 0, meets: 0, attention: 0, unanswered: 0, worth: [] });
    expect(empty.next).toBeNull();
    const { id } = await addPlace("home");
    await answerCheck(id, "home_gas", "gas_none", NOW);
    await answerCheck(id, "home_radon", "low", NOW);
    await answerCheck(id, "home_dust", "both", NOW);
    const o = await getPlacesOverview(NOW);
    expect(o.summary).toMatchObject({ places: 1, compared: 3, meets: 2, attention: 1 });
    expect(o.summary.unanswered).toBe(checksFor("home").length - 3);
    expect(o.summary.worth).toEqual([{ placeLabel: "Home", short: "gas cooking" }]);
    expect(o.next!.reason).toBe("unanswered");
    expect(o.next!.place.id).toBe(id);
  });

  test("marking a tip about a finding done brings that question back first, until the answer is updated", async () => {
    const { id } = await addPlace("home");
    await answerCheck(id, "home_gas", "gas_none", at(5));
    await db.markActionCompleted("nitrogen_dioxide_gas_stove:0", "Run the hood while you cook", todayISO(at(2)));
    const o = await getPlacesOverview(NOW);
    expect(o.completedOn).toEqual({ nitrogen_dioxide_gas_stove: daysAgoISO(2, NOW) });
    expect(o.next).toMatchObject({ reason: "recheck" });
    expect(o.next!.check.id).toBe("home_gas");
    await answerCheck(id, "home_gas", "gas_vented", at(1));
    expect((await getPlacesOverview(NOW)).next!.reason).not.toBe("recheck");
  });

  test("a tip marked done a long time ago no longer prompts a second look", async () => {
    const { id } = await addPlace("home");
    await answerCheck(id, "home_gas", "gas_none", at(80));
    await db.markActionCompleted("nitrogen_dioxide_gas_stove:0", "Run the hood while you cook", todayISO(at(60)));
    expect((await getPlacesOverview(NOW)).completedOn).toEqual({});
  });

  test("the worth-a-look list runs from the most consequential finding down", async () => {
    const { id } = await addPlace("home");
    await answerCheck(id, "home_scents", "some", NOW); // light, half in place
    await answerCheck(id, "home_radon", "high", NOW); // heavier, fully in place
    await answerCheck(id, "home_gas", "gas_some", NOW);
    const worth = (await getPlacesOverview(NOW)).summary.worth.map((w) => w.short);
    expect(worth[0]).toBe("radon");
    expect(worth[worth.length - 1]).toBe("candles, incense and air fresheners");
  });
});
