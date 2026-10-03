/**
 * Feedback goes to an inbox, not a public GitHub issue: someone describing what confused
 * them may paste in details from their own logged entries without thinking, and this app
 * has no server to hold that privately -- an email only the recipient sees is the private
 * option. Nothing is collected to send alongside it; this is only ever sent when the person
 * taps the button, through their own mail app, and they can read and edit it first.
 */
import { Linking, Platform } from "react-native";
import { getLanguage, tr } from "../i18n";

const FEEDBACK_EMAIL = "jasonjessewang@gmail.com";

export function feedbackMailtoUrl(detail?: string): string {
  // the subject stays English (and names the language) so feedback is easy to find; the prompt is for the person writing
  const subject = `Exposure Awareness feedback (${getLanguage()})`; // i18n-ignore: read by the developer
  const lines = [tr("What happened, and what were you expecting instead?"), "", ""];
  if (detail) lines.push("---", detail, "");
  lines.push(`Platform: ${Platform.OS}`); // i18n-ignore: read by the developer
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

/** `detail` is a one-line technical hint (e.g. an error name + message) to prefill, for when this is reached from a broken screen rather than picked from a menu. */
export function openFeedback(detail?: string): Promise<void> {
  return Linking.openURL(feedbackMailtoUrl(detail));
}
