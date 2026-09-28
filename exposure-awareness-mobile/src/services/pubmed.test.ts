import { shouldRefreshLiterature } from "./pubmed";

describe("when the app looks for fresh paper titles", () => {
  test("not before setup is finished: nobody has been told what leaves the device yet", () => {
    expect(shouldRefreshLiterature(null)).toBe(false);
  });
  test("only for someone who turned learning moments on, since those screens are the only place the titles appear", () => {
    expect(shouldRefreshLiterature({ learningMoments: true })).toBe(true);
  });
  test("not by default: learning moments start off (calm defaults), so a profile without the choice makes no request", () => {
    expect(shouldRefreshLiterature({})).toBe(false);
  });
  test("never for someone who chose to go straight there: they would not see the titles", () => {
    expect(shouldRefreshLiterature({ learningMoments: false })).toBe(false);
  });
});
