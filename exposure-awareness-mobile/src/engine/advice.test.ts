import AsyncStorage from "@react-native-async-storage/async-storage";
import * as db from "../storage/db";
import { getAdviceInputs, keepAdvice, KEEP_DAYS } from "./adviceState";
import { daysAgoISO } from "../util/dates";
import { scoreLogs } from "./scoring";

const now = new Date(2026, 8, 25, 12);
const emptyLogs = { food: [], products: [], environment: [], air_quality: [], practices: [] };

const shelfItem = (name: string, ingredientsText: string, frequency: "daily" | "weekly" = "daily") =>
  db.insertShelfItem({ name, brand: "", kind: "personal_care", barcode: null, source: "text", ingredientsText, nova: null, nutrition: null, frequency, servingsPerUse: 1 });

/** Shelf items are stamped with the real clock when added, so "a moment later" is measured against it. */
const afterInsert = () => new Date(Date.now() + 60000);

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("keeping advice (the person's own decision)", () => {
  test("a kept source is in force until its last day, inclusive, then comes back", async () => {
    await keepAdvice("triclosan", "Triclosan", now);
    const last = daysAgoISO(-KEEP_DAYS, now);
    expect((await db.getKeptAdvice(last)).map((k) => k.source_key)).toEqual(["triclosan"]);
    expect(await db.getKeptAdvice(daysAgoISO(-KEEP_DAYS - 1, now))).toEqual([]);
  });

  test("deciding again replaces the earlier decision instead of stacking", async () => {
    await keepAdvice("triclosan", "Triclosan", new Date(2026, 8, 1, 12));
    await keepAdvice("triclosan", "Triclosan", now);
    const kept = await db.getKeptAdvice(daysAgoISO(0, now));
    expect(kept).toHaveLength(1);
    expect(kept[0].decided_date).toBe(daysAgoISO(0, now));
  });

  test("it can be undone", async () => {
    await keepAdvice("triclosan", "Triclosan", now);
    await db.unkeepAdvice("triclosan");
    expect(await db.getKeptAdvice(daysAgoISO(0, now))).toEqual([]);
  });

  test("keeping is a decision, not an action taken: it never counts as a completed action", async () => {
    await keepAdvice("triclosan", "Triclosan", now);
    expect((await db.getCompletedActionKeys()).size).toBe(0);
  });

  test("concurrent decisions all survive", async () => {
    await Promise.all(["triclosan", "parabens", "phthalates", "mold_indoor"].map((k) => keepAdvice(k, k, now)));
    expect(await db.getKeptAdvice(daysAgoISO(0, now))).toHaveLength(4);
  });

  test("clearAll wipes decisions along with everything else", async () => {
    await keepAdvice("triclosan", "Triclosan", now);
    await db.clearAll();
    expect(await db.getKeptAdvice(daysAgoISO(0, now))).toEqual([]);
  });
});

describe("advice inputs", () => {
  test("carry what the shelf holds and what has been kept, ready for scoreLogs", async () => {
    await shelfItem("Daily lotion", "Water, Methylparaben, Triclosan");
    await keepAdvice("triclosan", "Triclosan", now);
    const advice = await getAdviceInputs(afterInsert());
    expect(advice.standing.map((s) => s.substanceId)).toEqual(expect.arrayContaining(["parabens", "triclosan"]));
    expect(advice.kept).toEqual(new Set(["triclosan"]));

    const report = scoreLogs(emptyLogs, undefined, new Set(), advice);
    const focus = report.focus_items.map((i) => i.tip_key.split(":")[0]);
    expect(focus).toContain("parabens");
    expect(focus).not.toContain("triclosan");
  });

  test("retiring the product from the shelf ends the advice about it", async () => {
    const item = await shelfItem("Daily lotion", "Water, Methylparaben");
    expect((await getAdviceInputs(afterInsert())).standing.map((s) => s.substanceId)).toContain("parabens");
    await db.removeShelfItem(item.id);
    expect((await getAdviceInputs(new Date(Date.now() + 120000))).standing).toEqual([]);
  });

  test("an empty shelf and no decisions means no extra advice", async () => {
    const advice = await getAdviceInputs(now);
    expect(advice.standing).toEqual([]);
    expect(advice.kept.size).toBe(0);
  });
});
