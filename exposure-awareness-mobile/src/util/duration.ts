/**
 * Reading a duration the way a person types it. "7.5" for a night's sleep means hours, not seven and a half minutes; "450" means
 * minutes; "7h30", "7:30" and "1.5h" mean what they say. Nothing here guesses when it cannot: it returns null, and the screen says so.
 */
export interface ParsedDuration {
  minutes: number;
}

const MAX_MINUTES = 24 * 60;

/**
 * @param text what the person typed
 * @param bareNumber how a plain number is read: "minutes" always, or "hours-if-small" (a number up to 24 is hours; larger is minutes),
 *   which is right for sleep and wrong for a walk
 */
export function parseDuration(text: string, bareNumber: "minutes" | "hours-if-small" = "minutes"): ParsedDuration | null {
  const t = text.trim().toLowerCase().replace(",", ".");
  if (!t) return null;
  let minutes: number | null = null;

  let m = t.match(/^(\d{1,2}):(\d{2})$/); // 7:30
  if (m) minutes = Number(m[1]) * 60 + Number(m[2]);

  if (minutes === null && (m = t.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\s*(?:(\d+)\s*(?:m(?:in(?:ute)?s?)?)?)?$/))) minutes = Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0); // 7h30, 1.5h, 2 hours 15 min
  if (minutes === null && (m = t.match(/^(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?$/))) minutes = Number(m[1]); // 90 min
  if (minutes === null && (m = t.match(/^\d+(?:\.\d+)?$/))) {
    const n = Number(t);
    minutes = bareNumber === "hours-if-small" && n <= 24 ? n * 60 : n;
  }

  if (minutes === null || !Number.isFinite(minutes) || minutes <= 0 || minutes > MAX_MINUTES) return null;
  return { minutes: Math.round(minutes) };
}
