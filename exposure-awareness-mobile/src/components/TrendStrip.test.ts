import { barShare } from "./TrendStrip";

describe("the readings strip is scaled to a person's own range, and never hides a reading", () => {
  test("lowest is a visible stub, highest is full height, the rest fall between in proportion", () => {
    expect(barShare(60, 60, 80)).toBeCloseTo(0.22, 5);
    expect(barShare(80, 60, 80)).toBe(1);
    expect(barShare(70, 60, 80)).toBeCloseTo(0.61, 5);
  });
  test("readings that are all the same read as steady, not as zero", () => {
    expect(barShare(62, 62, 62)).toBe(0.6);
  });
  test("never taller than the strip, never shorter than a stub", () => {
    for (const v of [-5, 0, 3.3, 100]) {
      const s = barShare(v, -5, 100);
      expect(s).toBeGreaterThanOrEqual(0.22);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});
