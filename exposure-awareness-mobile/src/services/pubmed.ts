/**
 * Recent literature for the loading screens, via NCBI E-utilities (free, keyless, no
 * account). Only titles + citation are used -- never abstracts. Refreshed at most once a
 * day and cached; falls back to bundled real records when offline.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LITERATURE_FALLBACK, type LiteratureItem } from "../data/literatureFallback";
import { learningMomentsOn } from "../engine/calm";

export type { LiteratureItem };

const CACHE_KEY = "exposure:literature_cache";
const DAY_MS = 86400000;
const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";

const TOPICS: { label: string; term: string }[] = [
  { label: "Microplastics", term: "microplastic*[ti] AND (human*[ti] OR health[ti] OR exposure[ti])" },
  { label: "PFAS", term: "(PFAS[ti] OR polyfluoroalkyl[ti])" },
  { label: "Exposome", term: "exposome[ti]" },
  { label: "Air pollution", term: '"air pollution"[ti] AND health[ti]' },
  { label: "Endocrine disruptors", term: "phthalate*[ti]" },
  { label: "Toxicokinetics", term: "toxicokinetic*[ti]" },
  { label: "Indoor air", term: '"indoor air"[ti]' },
  { label: "Aggregate exposure", term: '"aggregate exposure"[ti]' },
  { label: "Nature / Science", term: '(Nature[ta] OR Science[ta] OR Nat Commun[ta]) AND (toxic*[ti] OR pollution[ti] OR "human exposure"[ti] OR "chemical exposure"[ti])' },
];

export function cleanTitle(raw: string): string {
  return raw.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").replace(/\.$/, "").trim();
}

async function fetchTopic(label: string, term: string): Promise<LiteratureItem[]> {
  const search = `${BASE}esearch.fcgi?db=pubmed&retmode=json&retmax=2&sort=pub_date&datetype=pdat&reldate=365&term=${encodeURIComponent(term)}`;
  const ids: string[] = (await (await fetch(search)).json())?.esearchresult?.idlist ?? [];
  if (ids.length === 0) return [];
  const summary = await (await fetch(`${BASE}esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`)).json();
  return ids
    .map((id) => summary?.result?.[id])
    .filter(Boolean)
    .map((r: { uid: string; title: string; source?: string; pubdate?: string }) => ({
      pmid: r.uid,
      topic: label,
      title: cleanTitle(r.title),
      journal: r.source ?? "",
      year: (r.pubdate ?? "").slice(0, 4),
    }));
}

/** Cached items if present, otherwise the bundled real records. Never throws. */
export async function getLiterature(): Promise<LiteratureItem[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const { items } = JSON.parse(raw) as { fetchedAt: number; items: LiteratureItem[] };
      if (items?.length) return items;
    }
  } catch {}
  return LITERATURE_FALLBACK;
}

/**
 * Whether the app should look for fresh paper titles at all. They only appear on the learning-moment screens, so a person who chose
 * "Straight there" never sees them -- and a person who has not finished setting up has not yet been told what leaves the device.
 * In both cases the app makes no request.
 */
export function shouldRefreshLiterature(profile: { learningMoments?: boolean } | null): boolean {
  return profile !== null && learningMomentsOn(profile);
}

/** Fire-and-forget: re-pulls at most once per day, sequentially to respect NCBI's rate limit. */
export async function refreshLiteratureIfStale(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw && Date.now() - (JSON.parse(raw) as { fetchedAt: number }).fetchedAt < DAY_MS) return;
    const items: LiteratureItem[] = [];
    for (const t of TOPICS) {
      try {
        items.push(...(await fetchTopic(t.label, t.term)));
      } catch {}
      await new Promise((r) => setTimeout(r, 400));
    }
    const unique = [...new Map(items.map((i) => [i.pmid, i])).values()];
    if (unique.length >= 3) await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), items: unique }));
  } catch {}
}

/** When the literature list was last refreshed from PubMed (null = never; bundled records in use). */
export async function getLiteratureStatus(): Promise<{ fetchedAt: number | null; count: number }> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const { fetchedAt, items } = JSON.parse(raw) as { fetchedAt: number; items: LiteratureItem[] };
      return { fetchedAt, count: items.length };
    }
  } catch {}
  return { fetchedAt: null, count: LITERATURE_FALLBACK.length };
}
