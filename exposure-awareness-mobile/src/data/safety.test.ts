import { CLINICIAN_NOTE, POISON_HELP_US, SCOPE_NOTE, URGENT_NOTE } from "./safety";

describe("what the app is for, and what to do when something is urgent", () => {
  test("the urgent note names a number to call and says to call instead of using the app", () => {
    expect(POISON_HELP_US).toBe("1-800-222-1222");
    expect(URGENT_NOTE).toContain(POISON_HELP_US);
    expect(URGENT_NOTE).toMatch(/emergency number/);
    expect(URGENT_NOTE).toMatch(/don't use the app/);
  });

  test("the scope note says what the app does not do", () => {
    expect(SCOPE_NOTE).toMatch(/doesn't diagnose or treat/);
    expect(SCOPE_NOTE).toMatch(/doesn't replace a clinician/);
  });

  test("the wording stays calm: it informs and points to help without alarm", () => {
    for (const text of [SCOPE_NOTE, URGENT_NOTE, CLINICIAN_NOTE]) {
      expect(text).not.toMatch(/\b(danger|dangerous|toxic|unsafe|deadly|fatal|panic|warning)\b/i);
      expect(text).not.toMatch(/!/);
    }
  });
});
