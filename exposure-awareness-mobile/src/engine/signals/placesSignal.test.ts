/**
 * The places signal: answers compared with published references, weighted by concern, hours spent and who shares the place.
 */
import { placesSignal } from "./places";
import { makeData, type Fixture } from "./fixtures";
import type { SignalResult } from "./types";
import { checksFor } from "../../data/placeChecks";

const ASOF = "2026-09-25";
const D = "2026-09-01";
const run = (f: Fixture, asOf = ASOF): SignalResult => placesSignal.evaluate({ asOf, data: makeData(f) });
const answers = (list: Record<string, string>, day = D) => Object.entries(list).map(([check, value]) => ({ check, value, day }));

/** every check of a kind answered with an option that meets its reference */
const allMeet = (kind: "home" | "work" | "daily", day = D) => checksFor(kind).map((c) => ({ check: c.id, value: c.options.find((o) => o.status === "meets")!.value, day }));

describe("with nothing to compare", () => {
  test("no places, or places with no answers: no evidence, and it says so instead of scoring", () => {
    for (const f of [{}, { places: [{ kind: "home" as const }] }]) {
      const r = run(f);
      expect(r.confidence).toBe(0);
      expect(r.value).toBe(0);
      expect(r.summary).toMatch(/No places checked yet/);
      expect(r.parts).toHaveLength(1);
      expect(r.parts[0].read).toBe("not_enough_yet");
      expect(r.parts[0].ratio).toBeNull();
      expect(r.parts[0].against).toMatch(/EPA/);
    }
  });

  test("a place with only 'not sure' and 'doesn't apply' answers is still nothing to compare", () => {
    const r = run({ places: [{ kind: "home", answers: answers({ home_radon: "unsure", home_filter: "none" }) }] });
    expect(r.confidence).toBe(0);
    expect(r.notes.join(" ")).toMatch(/not answered yet/);
  });
});

describe("what it measures", () => {
  test("everything meeting its reference reads as the top of the range, and each place says what it was compared with", () => {
    const r = run({ places: [{ kind: "home", answers: allMeet("home") }, { kind: "work", answers: allMeet("work") }] });
    expect(r.value).toBeGreaterThan(97); // it leans a little toward a typical place until much more has been compared
    expect(r.confidence).toBe(1);
    expect(r.parts.map((p) => p.label)).toEqual(["Home", "Work"]);
    for (const p of r.parts) {
      expect(p.read).toBe("on_target");
      expect(p.ratio).toBe(1);
      expect(p.measured).toMatch(/^\d+ of \d+ checks meet the reference$/);
      expect(p.against).toMatch(/US EPA/);
    }
    expect(r.notes.join(" ")).toMatch(/meets its reference/);
  });

  test("the comparison is honest about its source: published guidance where an authority gives a number, the app's own curated guidance where not", () => {
    // work_new (new furnishings) is the app's curated guidance; radon is EPA
    const published = run({ places: [{ kind: "home", answers: answers({ home_radon: "low", home_moisture: "none", home_lead: "new" }) }] });
    expect(published.parts[0].basis).toBe("guideline");
    expect(published.parts[0].against).toBe("US EPA guidance");
    const onlyCurated = run({ places: [{ kind: "home", answers: answers({ home_scents: "daily", home_laundry: "regular", home_dust: "neither" }) }] });
    expect(onlyCurated.parts[0].basis).toBe("reference_rules");
    expect(onlyCurated.parts[0].against).toMatch(/curated guidance/);
    expect(onlyCurated.parts[0].against).not.toMatch(/EPA/);
    const mixed = run({ places: [{ kind: "home", answers: answers({ home_radon: "low", home_scents: "daily", home_laundry: "regular" }) }] });
    expect(mixed.parts[0].basis).toBe("guideline"); // partly a guideline comparison
    expect(mixed.parts[0].against).toBe("US EPA guidance for 1 of these checks, and this app's curated guidance for the other 2");
  });

  test("a finding that is only partly in place gets partial credit, so a half-fix moves the value half way", () => {
    const one = (v: string) => run({ places: [{ kind: "home", answers: answers({ home_gas: v }) }] }).value;
    expect(one("electric")).toBe(one("gas_vented"));
    expect(one("electric")).toBeGreaterThan(one("gas_some"));
    expect(one("gas_some")).toBeGreaterThan(one("gas_none"));
    expect(one("gas_some") - one("gas_none")).toBeCloseTo((one("electric") - one("gas_none")) / 2, 5);
  });

  test("the value leans toward a typical place while little has been compared, so the first answer does not swing it", () => {
    const one = (v: string) => run({ places: [{ kind: "home", answers: answers({ home_gas: v }) }] });
    expect(one("electric").value).toBeLessThan(90);
    expect(one("gas_none").value).toBeGreaterThan(30);
    expect(one("gas_none").notes.join(" ")).toMatch(/leans toward a typical place/);
    expect(run({ places: [{ kind: "home", answers: allMeet("home") }] }).notes.join(" ")).not.toMatch(/leans toward/);
  });

  test("answering more that meets the reference never lowers it, and it never reads as nothing at all", () => {
    const all = allMeet("home");
    for (let n = 1; n < all.length; n++) {
      expect(run({ places: [{ kind: "home", answers: all.slice(0, n + 1) }] }).value).toBeGreaterThanOrEqual(run({ places: [{ kind: "home", answers: all.slice(0, n) }] }).value - 1e-9);
    }
    const worst = checksFor("home").map((c) => ({ check: c.id, value: [...c.options].filter((o) => o.status === "attention").sort((a, b) => (b.standing ?? 0) - (a.standing ?? 0))[0].value, day: D }));
    const v = run({ places: [{ kind: "home", answers: worst }] }).value;
    expect(v).toBeGreaterThanOrEqual(5);
    expect(v).toBeLessThan(15);
  });

  test("worth-attention findings are named, most consequential first, without a verdict", () => {
    const r = run({ places: [{ kind: "home", answers: allMeet("home") }] });
    expect(r.notes.join(" ")).not.toMatch(/Worth a look/);
    const r2 = run({ places: [{ kind: "home", answers: [...allMeet("home").filter((a) => a.check !== "home_radon" && a.check !== "home_gas"), ...answers({ home_radon: "high", home_gas: "gas_some" })] }] });
    const note = r2.notes.find((n) => n.startsWith("Worth a look first"))!;
    expect(note).toMatch(/Home: radon/);
    expect(note.indexOf("radon")).toBeLessThan(note.indexOf("gas cooking")); // higher concern and more still in place comes first
    for (const t of [r2.summary, ...r2.notes, ...r2.parts.map((p) => `${p.measured} ${p.against}`)]) expect(t).not.toMatch(/\b(risk|danger|toxic|unsafe|bad|fail)\b/i);
  });

  test("the answer in force on the day is what is compared: fixing a thing raises the value from that day on", () => {
    const f: Fixture = { places: [{ kind: "home", answers: [...allMeet("home").filter((a) => a.check !== "home_gas"), ...answers({ home_gas: "gas_none" }, "2026-08-01"), ...answers({ home_gas: "gas_vented" }, "2026-09-10")] }] };
    expect(run(f, "2026-09-05").value).toBeLessThan(run(f, "2026-09-15").value);
    expect(run(f, "2026-09-15").value).toBeGreaterThan(95);
  });
});

describe("what makes a finding count for more", () => {
  const scattered = (extra: Partial<NonNullable<Fixture["places"]>[number]> = {}, kind: "home" | "work" | "daily" = "home") => ({ kind, answers: [...allMeet(kind).filter((a) => a.check !== "home_smoke" && a.check !== "daily_traffic"), ...answers({ [kind === "home" ? "home_smoke" : "daily_traffic"]: kind === "home" ? "indoors" : "lots" })], ...extra });

  test("the same finding drags the value more in the place where more of the week is spent", () => {
    const clean = (hours: number) => run({ places: [{ kind: "home", hours, answers: allMeet("home") }, { kind: "work", answers: allMeet("work") }] }).value;
    const found = (hours: number) => run({ places: [scattered({ hours }), { kind: "work", answers: allMeet("work") }] }).value;
    expect(clean(100) - found(100)).toBeGreaterThan(clean(10) - found(10));
  });

  test("and more when someone it matters especially for shares the place", () => {
    const alone = run({ places: [scattered()], profile: null });
    const shared = run({ places: [scattered({ occupants: [{ label: "Priya", conditions: ["asthma"] }] })], profile: null });
    expect(shared.value).toBeLessThan(alone.value);
    expect(shared.notes.join(" ")).toMatch(/counts for a little more because Priya \(asthma/);
    expect(alone.notes.join(" ")).not.toMatch(/counts for a little more/);
  });

  test("the user's own profile is part of the household: their asthma counts in every place", () => {
    const plain = run({ places: [scattered()], profile: {} });
    const asthma = run({ places: [scattered()], profile: { conditions: ["asthma"] } });
    expect(asthma.value).toBeLessThan(plain.value);
    expect(asthma.notes.join(" ")).not.toMatch(/because You/); // the user is not named as someone else sharing it
  });

  test("a concern the database rates higher counts for more than a lighter one", () => {
    const heavy = run({ places: [{ kind: "home", answers: [...allMeet("home").filter((a) => a.check !== "home_radon"), ...answers({ home_radon: "high" })] }] }); // radon: concern 3
    const light = run({ places: [{ kind: "home", answers: [...allMeet("home").filter((a) => a.check !== "home_scents"), ...answers({ home_scents: "daily" })] }] });
    expect(heavy.value).toBeLessThan(light.value);
  });
});

describe("how much evidence stands behind it", () => {
  test("confidence grows with the number of answered comparisons, and is full at eight", () => {
    const conf = (n: number) => run({ places: [{ kind: "home", answers: allMeet("home").slice(0, n) }] }).confidence;
    expect(conf(1)).toBeCloseTo(1 / 8, 2);
    expect(conf(4)).toBeCloseTo(0.5, 2);
    expect(conf(8)).toBe(1);
    expect(conf(12)).toBe(1);
  });

  test("answers over a year old still count, but carry less evidence, and the note says a fresh look would help", () => {
    const fresh = run({ places: [{ kind: "home", answers: allMeet("home").slice(0, 8) }] });
    const old = run({ places: [{ kind: "home", answers: allMeet("home", "2025-03-01").slice(0, 8) }] });
    expect(old.value).toBe(fresh.value);
    expect(old.confidence).toBeLessThan(fresh.confidence);
    expect(old.confidence).toBeGreaterThan(0.4);
    expect(old.notes.join(" ")).toMatch(/8 answers are over a year old/);
    expect(fresh.notes.join(" ")).not.toMatch(/over a year old/);
  });

  test("unanswered checks are named as what would fill the picture in, not as a shortfall", () => {
    const r = run({ places: [{ kind: "home", answers: allMeet("home").slice(0, 4) }] });
    const note = r.notes.find((n) => /not answered yet/.test(n))!;
    expect(note).toMatch(/Each one you answer fills in the picture/);
    expect(note).toMatch(/Home: /);
  });

  test("answers from after the day being read do not exist yet", () => {
    const r = run({ places: [{ kind: "home", answers: allMeet("home", "2026-09-20") }] }, "2026-09-10");
    expect(r.confidence).toBe(0);
  });
});

describe("read by place", () => {
  test("a place with too little to compare reads 'not enough yet'; a mostly-met place reads on target; a mostly-attention place reads room to grow", () => {
    const r = run({
      places: [
        { kind: "home", label: "Home", answers: answers({ home_radon: "low", home_lead: "new" }) },
        { kind: "work", label: "Work", answers: answers({ work_air: "ok", work_filters: "yes", work_new: "none", work_moisture: "none" }) },
        { kind: "daily", label: "Commute", answers: answers({ daily_traffic: "lots", daily_smoke_days: "no", daily_bottles: "both" }) },
      ],
    });
    const read = Object.fromEntries(r.parts.map((p) => [p.label, p.read]));
    expect(read.Home).toBe("not_enough_yet");
    expect(read.Work).toBe("on_target");
    expect(read.Commute).toBe("room_to_grow");
  });

  test("two homes are two comparisons", () => {
    const r = run({ places: [{ kind: "home", label: "Flat", answers: allMeet("home") }, { kind: "home", label: "Parents' house", answers: answers({ home_radon: "never", home_lead: "old", home_moisture: "ongoing" }) }] });
    expect(r.parts.map((p) => p.label)).toEqual(["Flat", "Parents' house"]);
    expect(r.parts[0].read).toBe("on_target");
    expect(r.parts[1].read).toBe("room_to_grow");
  });
});
