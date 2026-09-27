import { shouldRefreshLiterature } from "./pubmed";

describe("when the app looks for fresh paper titles", () => {
  test("not before setup is finished: nobody has been told what leaves the device yet", () => {
    expect(shouldRefreshLiterature(null)).toBe(false);
  });
  test("by default once set up, since the learning-moment screens use them", () => {
    expect(shouldRefreshLiterature({})).toBe(true);
    expect(shouldRefreshLiterature({ learningMoments: true })).toBe(true);
  });
  test("never for someone who chose to go straight there: they would not see the titles", () => {
    expect(shouldRefreshLiterature({ learningMoments: false })).toBe(false);
  });
});
