/**
 * Growth path for the evidence library: pull recent + highly-cited PubMed records for the
 * tracked topics, attach NIH iCite citation counts, and store them as needs_summary=1.
 * They are NOT shown to users until a reviewed summary is written (by an editor, or an LLM
 * draft that a human approves) -- the library never publishes unreviewed claims.
 * Run: npm run sync-literature
 */
import { db } from "./db.ts";

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";
const TOPICS: Record<string, string> = {
  microplastics: "microplastic*[ti] AND (human*[ti] OR health[ti])",
  pfas: "(PFAS[ti] OR polyfluoroalkyl[ti]) AND (review[pt] OR systematic[sb])",
  exposome: "exposome[ti]",
  air: '"air pollution"[ti] AND health[ti] AND (review[pt] OR meta-analysis[pt])',
  chemicals: "endocrine disrupt*[ti] AND (review[pt] OR meta-analysis[pt])",
};

async function json(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export async function syncLiterature(perTopic = 5): Promise<number> {
  let added = 0;
  const insert = db.prepare(
    `INSERT OR IGNORE INTO evidence (id, pmid, title, first_author, journal, year, citation_count, citations_as_of, citation_source, url, source, needs_summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NIH iCite', ?, 'pubmed', 1)`
  );
  const link = db.prepare("INSERT OR IGNORE INTO evidence_links (evidence_id, kind, value) VALUES (?, 'topic', ?)");
  for (const [topic, term] of Object.entries(TOPICS)) {
    const ids: string[] = (await json(`${EUTILS}esearch.fcgi?db=pubmed&retmode=json&retmax=${perTopic}&sort=relevance&term=${encodeURIComponent(term)}`)).esearchresult.idlist;
    if (ids.length === 0) continue;
    const summary = (await json(`${EUTILS}esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`)).result;
    const cites = new Map<string, number>(((await json(`https://icite.od.nih.gov/api/pubs?pmids=${ids.join(",")}`)).data as any[]).map((d) => [String(d.pmid), d.citation_count ?? 0]));
    for (const id of ids) {
      const s = summary[id];
      if (!s) continue;
      const r = insert.run(`pmid_${id}`, id, String(s.title).replace(/\.$/, ""), s.authors?.[0]?.name ?? null, s.source ?? null, Number(String(s.pubdate).slice(0, 4)) || null, cites.get(id) ?? 0, new Date().toISOString().slice(0, 7), `https://pubmed.ncbi.nlm.nih.gov/${id}/`);
      link.run(`pmid_${id}`, topic);
      added += Number(r.changes);
    }
    await new Promise((r) => setTimeout(r, 400)); // NCBI: max ~3 requests/sec without a key
  }
  return added;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!)) {
  syncLiterature().then((n) => console.log(`added ${n} items awaiting summaries`));
}
