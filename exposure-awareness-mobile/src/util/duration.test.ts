import { parseDuration } from "./duration";

const mins = (t: string, how?: "minutes" | "hours-if-small") => parseDuration(t, how)?.minutes ?? null;

test("a bare number is minutes, unless it is sleep and small enough to be hours", () => {
  expect(mins("450")).toBe(450);
  expect(mins("30")).toBe(30);
  expect(mins("7.5", "hours-if-small")).toBe(450);
  expect(mins("8", "hours-if-small")).toBe(480);
  expect(mins("450", "hours-if-small")).toBe(450);
  expect(mins("24", "hours-if-small")).toBe(1440);
  expect(mins("7.5")).toBe(8); // 7.5 minutes, if that is really what was meant
});

test("hours and minutes as people write them", () => {
  expect(mins("7h30")).toBe(450);
  expect(mins("7 h 30 min")).toBe(450);
  expect(mins("7:30")).toBe(450);
  expect(mins("1.5h")).toBe(90);
  expect(mins("1,5h")).toBe(90);
  expect(mins("2 hours 15 minutes")).toBe(135);
  expect(mins("90 min")).toBe(90);
  expect(mins("45m")).toBe(45);
  expect(mins("8h", "hours-if-small")).toBe(480);
});

test("what it cannot read, it does not guess at", () => {
  for (const bad of ["", "   ", "abc", "seven", "-30", "0", "25:00", "1441", "7.5.2", "h", "12 apples"]) expect(parseDuration(bad, "hours-if-small")).toBeNull();
  expect(mins("1440")).toBe(1440);
});
