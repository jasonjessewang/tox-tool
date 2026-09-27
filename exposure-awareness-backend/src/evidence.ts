/**
 * Evidence library API. Every item has a one-line headline, a short vignette, and a full
 * detail view -- "summarized so people can distill, detailed so they can learn specifics".
 * Ranked by citation count (NIH iCite). Links to substances/concepts/topics live in an
 * indexed join table so the fusion engine can ask "what's the evidence for X" cheaply.
 */
import { Router } from "express";
import { db } from "./db.ts";
import { requireApiKey, type AuthedRequest } from "./auth.ts";
import { clampLimit } from "./pagination.ts";

interface EvidenceRow {
  seq: number;
  id: string;
  citation_count: number;
  key_findings_json: string | null;
  limitations_json: string | null;
  practical_json: string | null;
  [k: string]: unknown;
}

const encode = (r: EvidenceRow) => Buffer.from(`${r.citation_count}:${r.seq}`).toString("base64url");
function decode(c: unknown): { cc: number; seq: number } | null {
  if (typeof c !== "string" || !c) return null;
  const [cc, seq] = Buffer.from(c, "base64url").toString().split(":").map(Number);
  return Number.isInteger(cc) && Number.isInteger(seq) ? { cc, seq } : null;
}

function shape(row: EvidenceRow, detail: boolean) {
  const links = db.prepare("SELECT kind, value FROM evidence_links WHERE evidence_id = ?").all(row.id) as { kind: string; value: string }[];
  const pick = (k: string) => links.filter((l) => l.kind === k).map((l) => l.value);
  const base = {
    id: row.id, pmid: row.pmid, title: row.title, first_author: row.first_author, journal: row.journal, year: row.year,
    study_type: row.study_type, evidence_level: row.evidence_level, citation_count: row.citation_count,
    citations_as_of: row.citations_as_of, citation_source: row.citation_source,
    headline: row.headline, summary_short: row.summary_short, needs_summary: !!row.needs_summary, url: row.url, source: row.source,
    topics: pick("topic"), substance_ids: pick("substance"), context_substance_ids: pick("context_substance"), concept_tags: pick("concept"),
  };
  if (!detail) return base;
  return {
    ...base,
    summary_detail: row.summary_detail,
    key_findings: JSON.parse(row.key_findings_json ?? "[]"),
    limitations: JSON.parse(row.limitations_json ?? "[]"),
    practical: JSON.parse(row.practical_json ?? "[]"),
  };
}

export function buildEvidenceRouter(): Router {
  const r = Router();

  r.get("/", requireApiKey("read"), (req: AuthedRequest, res) => {
    const limit = clampLimit(req.query.limit);
    const cursor = decode(req.query.cursor);
    const where: string[] = ["needs_summary = 0"];
    const params: (string | number)[] = [];
    for (const [q, kind] of [["topic", "topic"], ["substance", "substance"], ["concept", "concept"]] as const) {
      if (req.query[q]) {
        where.push("EXISTS (SELECT 1 FROM evidence_links l WHERE l.evidence_id = evidence.id AND l.kind = ? AND l.value = ?)");
        params.push(kind, String(req.query[q]));
      }
    }
    if (cursor) {
      where.push("(citation_count < ? OR (citation_count = ? AND seq > ?))");
      params.push(cursor.cc, cursor.cc, cursor.seq);
    }
    const rows = db.prepare(`SELECT * FROM evidence WHERE ${where.join(" AND ")} ORDER BY citation_count DESC, seq ASC LIMIT ?`).all(...params, limit + 1) as EvidenceRow[];
    const page = rows.slice(0, limit);
    res.json({ data: page.map((x) => shape(x, false)), next_cursor: rows.length > limit ? encode(page[page.length - 1]) : null });
  });

  r.get("/:id", requireApiKey("read"), (req: AuthedRequest, res) => {
    const row = db.prepare("SELECT * FROM evidence WHERE id = ?").get(req.params.id) as EvidenceRow | undefined;
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: shape(row, true) });
  });

  return r;
}
