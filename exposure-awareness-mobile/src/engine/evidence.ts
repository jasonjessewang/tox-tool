/**
 * Evidence library, bundled for offline use. The source of truth is the backend's
 * seed/evidence.json (same file, same schema, served at /v1/evidence); every item carries a
 * headline, a short vignette, and a full detail write-up.
 */
import evidenceData from "../data/evidence.json";

export interface EvidenceItem {
  id: string;
  pmid: string;
  title: string;
  first_author: string;
  journal: string;
  year: number;
  study_type: string;
  evidence_level: string;
  topics: string[];
  /** substances these studies actually looked at */
  substance_ids: string[];
  /**
   * substances these studies are background for, not tests of: ultra-processed food research sits behind a page on food dyes, but no
   * dye was tested. Shown apart, and said so, so nearby evidence is never read as evidence for the thing itself.
   */
  context_substance_ids: string[];
  concept_tags: string[];
  citation_count: number;
  citations_as_of: string;
  citation_source: string;
  headline: string;
  summary_short: string;
  summary_detail: string;
  key_findings: string[];
  limitations: string[];
  practical: string[];
  url: string;
}

const ALL = evidenceData as EvidenceItem[];

export function loadEvidence(): EvidenceItem[] {
  return [...ALL].sort((a, b) => b.citation_count - a.citation_count);
}

export function evidenceById(id: string): EvidenceItem | undefined {
  return ALL.find((e) => e.id === id);
}

export function evidenceForSubstance(substanceId: string): EvidenceItem[] {
  return loadEvidence().filter((e) => e.substance_ids.includes(substanceId));
}

/** Studies of something close by: the page says they are context, not evidence about this substance. */
export function contextEvidenceForSubstance(substanceId: string): EvidenceItem[] {
  return loadEvidence().filter((e) => e.context_substance_ids.includes(substanceId));
}

export function evidenceForConcept(tag: string): EvidenceItem[] {
  return loadEvidence().filter((e) => e.concept_tags.includes(tag));
}

export const evidenceLearningRef = (id: string) => `evidence:${id}`;
