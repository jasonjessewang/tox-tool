import { Linking } from "react-native";
import { feedbackMailtoUrl, openFeedback } from "./feedback";

describe("feedbackMailtoUrl", () => {
  test("is a mailto link to the feedback address, with a subject and a prompt in the body", () => {
    const url = feedbackMailtoUrl();
    expect(url).toMatch(/^mailto:jasonjessewang@gmail\.com\?/);
    expect(url).toContain(encodeURIComponent("Exposure Awareness feedback"));
    expect(decodeURIComponent(url)).toContain("What happened, and what were you expecting instead?");
  });

  test("includes the platform, so a report says where it came from without anything being collected", () => {
    expect(decodeURIComponent(feedbackMailtoUrl())).toMatch(/Platform: \w+/);
  });

  test("an optional detail (e.g. a caught error) is folded into the body, not the subject", () => {
    const url = feedbackMailtoUrl("TypeError: x is not a function");
    expect(decodeURIComponent(url)).toContain("TypeError: x is not a function");
    expect(url.split("subject=")[1].split("&body=")[0]).not.toContain("TypeError");
  });

  test("with no detail, the body carries no leftover separator", () => {
    expect(decodeURIComponent(feedbackMailtoUrl())).not.toContain("---");
  });
});

describe("openFeedback", () => {
  test("opens exactly the URL feedbackMailtoUrl builds, and nothing else", async () => {
    const spy = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await openFeedback("some detail");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(feedbackMailtoUrl("some detail"));
    spy.mockRestore();
  });
});
