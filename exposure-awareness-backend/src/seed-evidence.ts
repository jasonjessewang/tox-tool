/** Idempotent loader for seed/evidence.json (curated, hand-summarized). Run: npm run seed */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./db.ts";

const dir = path.dirname(fileURLToPath(import.meta.url));

export function seedEvidence(file = path.join(dir, "..", "seed", "evidence.json")): number {
  const items = JSON.parse(readFileSync(file, "utf8")) as any[];
  const upsert = db.prepare(
    `INSERT INTO evidence (id, pmid, title, first_author, journal, year, study_type, evidence_level, citation_count, citations_as_of, citation_source,
       headline, summary_short, summary_detail, key_findings_json, limitations_json, practical_json, url, source, needs_summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT (id) DO UPDATE SET title=excluded.title, citation_count=excluded.citation_count, citations_as_of=excluded.citations_as_of,
       headline=excluded.headline, summary_short=excluded.summary_short, summary_detail=excluded.summary_detail,
       key_findings_json=excluded.key_findings_json, limitations_json=excluded.limitations_json, practical_json=excluded.practical_json,
       needs_summary=0, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`
  );
  const clearLinks = db.prepare("DELETE FROM evidence_links WHERE evidence_id = ?");
  const addLink = db.prepare("INSERT OR IGNORE INTO evidence_links (evidence_id, kind, value) VALUES (?, ?, ?)");
  for (const e of items) {
    upsert.run(e.id, e.pmid, e.title, e.first_author, e.journal, e.year, e.study_type, e.evidence_level, e.citation_count, e.citations_as_of, e.citation_source,
      e.headline, e.summary_short, e.summary_detail, JSON.stringify(e.key_findings), JSON.stringify(e.limitations), JSON.stringify(e.practical), e.url, e.source);
    clearLinks.run(e.id);
    for (const t of e.topics) addLink.run(e.id, "topic", t);
    for (const s of e.substance_ids) addLink.run(e.id, "substance", s);
    // studies of something close by: background for these substances, not evidence about them (never matched by ?substance=)
    for (const s of e.context_substance_ids ?? []) addLink.run(e.id, "context_substance", s);
    for (const c of e.concept_tags) addLink.run(e.id, "concept", c);
  }
  return items.length;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  console.log(`seeded ${seedEvidence()} evidence items`);
}
