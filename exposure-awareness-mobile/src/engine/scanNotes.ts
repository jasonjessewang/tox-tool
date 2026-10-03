/**
 * Scanning a product writes an entry (a food or product log) whose note starts with this. The entry
 * exists so the journey can count scans and the day counts as activity -- but it catalogs the product
 * rather than recording a meal eaten or a product used. How often the product is actually used is the
 * shelf ledger's job, so scan entries stay out of the week's logged pattern (see scoreLogs).
 */
export const SCAN_NOTE_PREFIX = "Scanned "; // i18n-ignore: a marker stored in entries and matched by isScanEntry()

export const isScanEntry = (entry: { notes?: string | null }): boolean => !!entry.notes && entry.notes.startsWith(SCAN_NOTE_PREFIX);
