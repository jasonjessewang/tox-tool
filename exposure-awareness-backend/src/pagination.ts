/**
 * Keyset (cursor) pagination, not OFFSET. A cursor is just the `seq` of the last row
 * seen, base64-encoded so it's opaque to API consumers (they shouldn't rely on it being
 * a raw integer, even though it is one today -- that's what lets the encoding change
 * later without breaking clients). `seq < cursor` stays index-backed at any page depth,
 * which is the actual mechanism behind "smooth pulls" as a list grows -- OFFSET-based
 * pagination has to walk and discard every prior row, which gets slower page by page.
 */
export function encodeCursor(seq: number): string {
  return Buffer.from(String(seq), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | undefined): number | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const n = Number(decoded);
    return Number.isInteger(n) ? n : null;
  } catch {
    return null;
  }
}

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export function clampLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.floor(n));
}
