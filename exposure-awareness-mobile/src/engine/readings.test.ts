import { trendsFrom, MAX_POINTS } from "./readings";
import type { BiomarkerLog } from "./types";

let n = 0;
const bio = (log_date: string, metric: string, value: number, unit = "bpm"): BiomarkerLog => ({ id: `b${n}`, log_date, metric, value, unit, source: "", notes: "", created_at: `2026-01-01T00:00:${String(n++).padStart(2, "0")}.000Z` });

describe("readings over time: the latest against your own earlier ones", () => {
  test("a single reading is a first reading; it says what a second one would add", () => {
    const [t] = trendsFrom([bio("2026-09-10", "Resting heart rate", 62)], "2026-09-25");
    expect(t.previous).toBeNull();
    expect(t.change).toBeNull();
    expect(t.direction).toBeNull();
    expect(t.daysSince).toBe(15);
    expect(t.sentence).toMatch(/Your first reading/);
  });

  test("two readings: the change, its direction, and both dates, in words", () => {
    const [t] = trendsFrom([bio("2026-08-01", "Resting heart rate", 70), bio("2026-09-10", "Resting heart rate", 62)], "2026-09-25");
    expect(t.change).toBe(-8);
    expect(t.direction).toBe("lower");
    expect(t.sentence).toBe("Resting heart rate: 62 bpm on 2026-09-10, lower than your 70 bpm on 2026-08-01 (-8).");
    const [up] = trendsFrom([bio("2026-08-01", "HRV", 40, "ms"), bio("2026-09-10", "HRV", 48.5, "ms")], "2026-09-25");
    expect(up.direction).toBe("higher");
    expect(up.sentence).toMatch(/higher than your 40 ms on 2026-08-01 \(\+8\.5\)/);
    const [same] = trendsFrom([bio("2026-08-01", "HRV", 40, "ms"), bio("2026-09-10", "HRV", 40, "ms")], "2026-09-25");
    expect(same.direction).toBe("unchanged");
  });

  test("the same metric is one metric however it was typed; a different metric is its own", () => {
    const list = trendsFrom([bio("2026-08-01", "Resting heart rate", 70), bio("2026-09-10", "  resting  Heart Rate ", 62), bio("2026-09-11", "HbA1c", 5.3, "%")], "2026-09-25");
    // named as the latest entry named it, with the stray spaces gone
    expect(list.map((t) => t.metric)).toEqual(["HbA1c", "resting Heart Rate"]);
    expect(list[1].count).toBe(2);
    expect(list[1].change).toBe(-8);
  });

  test("readings in different units are never compared with each other", () => {
    const [t] = trendsFrom([bio("2026-08-01", "Fasting glucose", 5.1, "mmol/L"), bio("2026-09-10", "Fasting glucose", 92, "mg/dL")], "2026-09-25");
    expect(t.change).toBeNull();
    expect(t.direction).toBeNull();
    expect(t.sentence).toMatch(/different unit \(mmol\/L\), so the two are not compared/);
    expect(t.points).toEqual([{ day: "2026-09-10", value: 92 }]);
  });

  test("two readings on one day: the one entered later is the latest", () => {
    const first = bio("2026-09-10", "HRV", 40, "ms");
    const second = bio("2026-09-10", "HRV", 45, "ms");
    const [t] = trendsFrom([first, second], "2026-09-25");
    expect(t.latest.value).toBe(45);
    expect(t.previous?.value).toBe(40);
  });

  test("as of an earlier day, later readings do not exist yet", () => {
    const all = [bio("2026-08-01", "HRV", 40, "ms"), bio("2026-09-10", "HRV", 48, "ms")];
    const [t] = trendsFrom(all, "2026-08-20");
    expect(t.latest.value).toBe(40);
    expect(t.previous).toBeNull();
    expect(trendsFrom(all, "2026-07-01")).toEqual([]);
  });

  test("the strip keeps the latest few, oldest first", () => {
    const many = Array.from({ length: 12 }, (_, i) => bio(`2026-08-${String(i + 1).padStart(2, "0")}`, "Resting heart rate", 60 + i));
    const [t] = trendsFrom(many, "2026-09-25");
    expect(t.count).toBe(12);
    expect(t.points).toHaveLength(MAX_POINTS);
    expect(t.points[0].day).toBe("2026-08-05");
    expect(t.points[MAX_POINTS - 1].day).toBe("2026-08-12");
  });

  test("most recently measured first; ties by name", () => {
    const list = trendsFrom([bio("2026-07-01", "A", 1), bio("2026-09-01", "B", 1), bio("2026-09-01", "C", 1)], "2026-09-25");
    expect(list.map((t) => t.metric)).toEqual(["B", "C", "A"]);
  });

  test("never says whether a number is good, normal or a concern", () => {
    const all = [bio("2026-08-01", "Blood pressure (systolic)", 150, "mmHg"), bio("2026-09-10", "Blood pressure (systolic)", 118, "mmHg"), bio("2026-09-11", "Blood lead level", 1.4, "µg/dL")];
    for (const t of trendsFrom(all, "2026-09-25")) expect(t.sentence).not.toMatch(/\b(normal|abnormal|healthy|unhealthy|good|bad|concern|concerning|worry|risk|dangerous|elevated|optimal|ideal)\b/i);
  });
});
