/**
 * The citations shown next to a topic must be about that topic. PubMed's relevance ranking alone put a green-spaces study
 * under "Lead" and a bladder-cancer paper under "VOC off-gassing", so entries now carry hand-picked PMIDs (`curated_pmids`, with
 * their metadata fetched live) and the words a searched paper's title must contain (`pubmed_anchors`); sync_db.py honors both.
 * These tests hold the shipped data to that.
 */
import { loadHazardDb } from "../engine/scoring";
import { PLACE_CHECKS } from "./placeChecks";

type Entry = ReturnType<typeof loadHazardDb>[number] & { curated_pmids?: string[]; pubmed_anchors?: string[] };
const substances = loadHazardDb() as Entry[];
const named = (title: string, anchors: string[]) => anchors.some((a) => new RegExp(`(?<!\\w)${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\w)`, "i").test(title));

test("every reference is a real PubMed record: an id, a title, a journal, a year, and a link that names the same id", () => {
  for (const s of substances) {
    for (const r of s.references ?? []) {
      expect(r.pmid).toMatch(/^\d+$/);
      expect(r.title.length).toBeGreaterThanOrEqual(3); // one real record is titled just "Radon"
      expect(typeof r.journal).toBe("string"); // a book-chapter record (StatPearls) has no journal
      expect(r.year).toMatch(/^\d{4}$/);
      expect(r.url).toBe(`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`);
    }
  }
});

test("hand-picked papers come first, in the order chosen, and none is repeated", () => {
  const curated = substances.filter((s) => (s.curated_pmids ?? []).length > 0);
  expect(curated.length).toBeGreaterThanOrEqual(12);
  for (const s of curated) {
    const ids = (s.references ?? []).map((r) => r.pmid);
    expect(ids.slice(0, s.curated_pmids!.length)).toEqual(s.curated_pmids);
    expect(new Set(ids).size).toBe(ids.length);
  }
});

test("a paper found by search is only kept if its title names the thing the topic is about", () => {
  for (const s of substances) {
    if (!s.pubmed_anchors || s.pubmed_anchors.length === 0) continue;
    for (const r of s.references ?? []) {
      if ((s.curated_pmids ?? []).includes(r.pmid)) continue; // chosen by a person, whatever its title says
      expect({ topic: s.id, title: r.title, ok: named(r.title, s.pubmed_anchors) }).toEqual({ topic: s.id, title: r.title, ok: true });
    }
  }
});

test("the topics the places checklist points at each show at least two citations, and the ones that were wrong are fixed", () => {
  const ids = new Set<string>();
  for (const c of PLACE_CHECKS) {
    ids.add(c.substanceId);
    for (const o of c.options) if (o.substanceId) ids.add(o.substanceId);
  }
  for (const id of ids) expect((substances.find((s) => s.id === id)!.references ?? []).length).toBeGreaterThanOrEqual(2);
  const titles = (id: string) => (substances.find((s) => s.id === id)!.references ?? []).map((r) => r.title.toLowerCase()).join(" | ");
  expect(titles("lead_exposure")).not.toMatch(/green space|hazardous waste/);
  expect(titles("lead_exposure")).toMatch(/lead/);
  expect(titles("low_humidity_dry_air")).toMatch(/humidity/);
  expect(titles("low_humidity_dry_air")).not.toMatch(/greenhouse|covid-19/);
  expect(titles("voc_off_gassing")).not.toMatch(/bladder|copd/);
  expect(titles("added_sugar")).not.toMatch(/ldl|metabolomic/);
});

test("a topic's own summary does not claim more than its citations support (the sugar entry's unsupported mechanism was removed)", () => {
  const sugar = substances.find((s) => s.id === "added_sugar")!;
  expect(sugar.summary).not.toMatch(/compound the body's ability to handle other exposures/);
  expect(sugar.summary).toMatch(/umbrella review/);
  expect(sugar.summary).toMatch(/low quality/); // the limits of the evidence are said alongside it
});
