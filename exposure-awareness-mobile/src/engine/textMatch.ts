/**
 * Free-text phrase matching shared by the log scorer, the produce tally and the ingredient matcher.
 *
 * The log scorer started as plain substring search. Running the engine over simulated weeks of real
 * meals showed it misfiring in both directions: "avocado toast" read as the VOC alias (and put a
 * pregnant persona's Focus list on indoor air for five straight weeks), "sleep rhythm" as a
 * chlorination byproduct, "secured" as cured meat, "percent" as dry-cleaning solvent, "sugar-free"
 * and "BPA-free" as the very thing they rule out, while "banana" never matched the produce list's
 * "bananas". So a phrase counts as mentioned only when it is:
 *
 *   - a whole word or phrase (a boundary on both sides; hyphens and spaces are interchangeable, so
 *     "BPA-lined" and "high-fructose corn syrup" still match);
 *   - tolerant of simple plurals in both directions ("phthalate" finds "Phthalates", "apple" finds
 *     "apples", "VOCs" finds "voc");
 *   - not negated: "BPA-free", "sugar free", "no added sugar", "without parabens", "free of phthalates".
 */

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Hyphens and spaces are the same separator; everything is compared lower-cased. */
const normalize = (s: string) => s.toLowerCase().replace(/-/g, " ");

/** True when the occurrence at [start, end) is negated: "sugar free", "free of BPA", "no added sugar", "non ...". */
export function isNegated(text: string, start: number, end: number): boolean {
  const after = text.slice(end, end + 8);
  const before = text.slice(Math.max(0, start - 14), start);
  return /^[\s-]*free\b/.test(after) || /(?:\bno|\bwithout|\bfree of|\bnon)[\s-]*(?:added\s+)?$/.test(before);
}

/** The phrase plus its singular spelling when it ends in a regular plural ("apples" -> "apple", "cherries" -> "cherry"). */
function spellings(phrase: string): string[] {
  const p = normalize(phrase).trim();
  const out = [p];
  if (p.length > 4) {
    if (p.endsWith("ies")) out.push(`${p.slice(0, -3)}y`);
    else if (/(?:ch|sh|x|ss|z|o)es$/.test(p)) out.push(p.slice(0, -2));
    else if (p.endsWith("s") && !p.endsWith("ss")) out.push(p.slice(0, -1));
  }
  return out;
}

/**
 * Compiles a set of phrases into one predicate: does the text mention any of them as a whole word,
 * at least once un-negated? Compile once and reuse -- building the regex is the expensive part.
 */
export function phraseMatcher(phrases: string[]): (text: string) => boolean {
  const unique = [...new Set(phrases.flatMap(spellings).filter((p) => p.length >= 2))].sort((a, b) => b.length - a.length);
  if (unique.length === 0) return () => false;
  const re = new RegExp(`(^|[^a-z0-9])(${unique.map(escapeRe).join("|")})(?:e?s)?(?![a-z0-9])`, "g");
  return (raw) => {
    const text = normalize(raw);
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const start = m.index + m[1].length;
      if (!isNegated(text, start, m.index + m[0].length)) return true;
    }
    return false;
  };
}
