import * as fs from "fs";
import * as path from "path";
import { loadEvidence, evidenceForSubstance, contextEvidenceForSubstance, evidenceForConcept, evidenceById } from "./evidence";
import { loadHazardDb, loadConcepts } from "./scoring";

test("the app's copy of the library and the backend's seed are byte-for-byte the same file", () => {
  const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", "..", p), "utf8");
  expect(read("src/data/evidence.json")).toBe(read("../exposure-awareness-backend/seed/evidence.json"));
});

test("every item has a headline, a short vignette AND a detailed write-up, with a real PMID link", () => {
  for (const e of loadEvidence()) {
    expect(e.headline.length).toBeGreaterThan(20);
    expect(e.summary_short.length).toBeGreaterThan(60);
    expect(e.summary_detail.length).toBeGreaterThan(300);
    expect(e.key_findings.length).toBeGreaterThan(0);
    expect(e.limitations.length).toBeGreaterThan(0);
    expect(e.url).toBe(`https://pubmed.ncbi.nlm.nih.gov/${e.pmid}/`);
    expect(e.citation_count).toBeGreaterThan(0);
  }
});

test("ranked by citation count, ids unique", () => {
  const list = loadEvidence();
  for (let i = 1; i < list.length; i++) expect(list[i - 1].citation_count).toBeGreaterThanOrEqual(list[i].citation_count);
  expect(new Set(list.map((e) => e.id)).size).toBe(list.length);
});

test("links point at substances and concepts that actually exist in the engine", () => {
  const substances = new Set(loadHazardDb().map((s) => s.id));
  const concepts = new Set(Object.keys(loadConcepts()));
  for (const e of loadEvidence()) {
    for (const s of e.substance_ids) expect(substances.has(s)).toBe(true);
    for (const s of e.context_substance_ids) expect(substances.has(s)).toBe(true);
    for (const c of e.concept_tags) expect(concepts.has(c)).toBe(true);
  }
});

test("a study is either about a substance or background for it, never both", () => {
  for (const e of loadEvidence()) {
    expect(e.context_substance_ids.filter((s) => e.substance_ids.includes(s))).toEqual([]);
  }
});

test("studies of ultra-processed food are background for food dyes and added sugar, not evidence about them", () => {
  const upf = ["pmid_31105044", "pmid_38363072"];
  for (const substance of ["artificial_food_dyes", "added_sugar"]) {
    expect(evidenceForSubstance(substance).map((e) => e.id)).not.toEqual(expect.arrayContaining(upf));
    expect(contextEvidenceForSubstance(substance).map((e) => e.id)).toEqual(expect.arrayContaining(upf));
  }
});

test("lookup helpers: lead has evidence, and animal-study caveats are stated for the sleep paper", () => {
  expect(evidenceForSubstance("lead_exposure").map((e) => e.pmid)).toContain("16002379");
  expect(evidenceForConcept("dose_response").length).toBeGreaterThan(0);
  const sleep = evidenceById("pmid_24136970")!;
  expect(sleep.study_type).toMatch(/mice/i);
  expect(sleep.limitations.join(" ")).toMatch(/mice/i);
});

test("no summary promises a cure or detox", () => {
  for (const e of loadEvidence()) {
    const t = `${e.headline} ${e.summary_short} ${e.summary_detail}`.toLowerCase();
    expect(t.includes("cure")).toBe(false);
    expect(t.includes("proves")).toBe(false);
  }
});
