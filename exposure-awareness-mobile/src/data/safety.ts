/**
 * What the app is for, and what to do instead of using it when something is urgent. Shown before the first step and again under
 * About you. One source, so the two places can never drift apart.
 *
 * A toxicology app is opened by people worried about something they did an hour ago as well as by people curious about their
 * shampoo. The first group needs a phone number, not a score.
 */
import { msg } from "../i18n";
export const POISON_HELP_US = "1-800-222-1222";

export const SCOPE_NOTE = msg(
  "This app is for awareness and learning: it turns public health guidance into a picture of your everyday exposures and the small things you can change. It doesn't diagnose or treat anything, and it doesn't replace a clinician."
);

// written out in full (not built from POISON_HELP_US) so it can be translated as one sentence; safety.test.ts holds the two together
export const URGENT_NOTE = msg("If someone may have swallowed, breathed in or been exposed to something harmful right now, don't use the app: call your local emergency number or poison centre (in the US, Poison Help: 1-800-222-1222).");

export const CLINICIAN_NOTE = msg("Anything that worries you -- a symptom, a lab value -- is worth taking to a clinician. The app can help you work out what to ask.");
