/**
 * Every piece of content the app shows from its data files, as the English text that `tr()` looks up where it is shown.
 *
 * The data files stay single-language: a lesson, a substance page or a place check is written once, in English, and each
 * language's content catalog maps that English to its translation. This list says which fields are shown (a lesson's title,
 * headline, body and so on) and leaves out what is not text for reading: ids, PubMed queries, aliases used for matching, and
 * paper titles and journal names, which stay as published. src/i18n/i18n.test.ts holds every catalog to it.
 *
 * Groups are the order the translations are written in: the substances, concepts and first steps a new person meets first,
 * the research summaries last.
 */
import { LESSONS, TIER_INFO, TOOL_INFO } from "../data/curriculum";
import { MODULE_INFO, MODULE_LESSONS } from "../data/modules";
import { CONCEPT_CHECKS, MODULE_CHECKS } from "../data/conceptChecks";
import { KIND_LABEL, WISDOM } from "../data/wisdom";
import { PLACE_CHECKS } from "../data/placeChecks";
import { STARTER_JOURNEY } from "../data/starterJourney";
import { LESSONS as PILLAR_LESSONS, PILLARS } from "../data/pillars";
import { GUIDELINES } from "../data/guidelines";
import { NUTRIENTS } from "../data/dailyValues";
import hazardDatabase from "../data/hazardDatabase.json";
import conceptsData from "../data/concepts.json";
import evidenceData from "../data/evidence.json";
import aqiBreakpoints from "../data/aqiBreakpoints.json";
import produceTiers from "../data/produceTiers.json";

export type ContentGroup =
  | "substances"
  | "concepts"
  | "places"
  | "journey"
  | "wisdom"
  | "lessons"
  | "checks"
  | "modules"
  | "module_checks"
  | "pillars"
  | "reference"
  | "technical"
  | "evidence";

export const CONTENT_GROUPS: ContentGroup[] = ["substances", "concepts", "places", "journey", "wisdom", "lessons", "checks", "modules", "module_checks", "pillars", "reference", "technical", "evidence"];

export interface ContentString {
  key: string;
  group: ContentGroup;
  /** where it comes from, for a translator: "substance radon summary_plain" */
  origin: string;
}

interface SubstanceText {
  id: string;
  name: string;
  summary: string;
  summary_plain?: string;
  technical_note?: string;
  common_sources?: string[];
  mitigation_tips: string[];
}
interface EvidenceText {
  id: string;
  headline: string;
  summary_short: string;
  summary_detail: string;
  key_findings: string[];
  limitations: string[];
  practical: string[];
  study_type: string;
  evidence_level: string;
}
interface AqiRow {
  category: string;
  guidance: string;
}

export function contentStrings(): ContentString[] {
  const out: ContentString[] = [];
  const add = (group: ContentGroup, origin: string, ...texts: (string | undefined | null)[]) => {
    for (const t of texts) if (t && t.trim()) out.push({ key: t, group, origin });
  };

  for (const s of (hazardDatabase as unknown as { substances: SubstanceText[] }).substances) {
    add("substances", `substance ${s.id} name`, s.name);
    add("substances", `substance ${s.id} summary_plain`, s.summary_plain);
    add("substances", `substance ${s.id} summary`, s.summary);
    s.mitigation_tips.forEach((t, i) => add("substances", `substance ${s.id} tip ${i + 1}`, t));
    (s.common_sources ?? []).forEach((t, i) => add("substances", `substance ${s.id} source ${i + 1}`, t));
    add("technical", `substance ${s.id} technical_note`, s.technical_note);
  }

  for (const c of (conceptsData as { concepts: { id: string; name: string; general: string; technical: string }[] }).concepts) {
    add("concepts", `concept ${c.id} name`, c.name);
    add("concepts", `concept ${c.id} general`, c.general);
    add("technical", `concept ${c.id} technical`, c.technical);
  }

  for (const c of PLACE_CHECKS) {
    add("places", `place check ${c.id} short`, c.short);
    add("places", `place check ${c.id} question`, c.question);
    add("places", `place check ${c.id} help`, c.help);
    c.options.forEach((o) => add("places", `place check ${c.id} option ${o.value}`, o.label));
    add("places", `place check ${c.id} reference`, c.reference.text);
    add("places", `place check ${c.id} source`, c.reference.source);
    add("places", `place check ${c.id} why`, c.why);
  }
  for (const [key, rows] of Object.entries(aqiBreakpoints as unknown as Record<string, AqiRow[] | object>)) {
    if (!Array.isArray(rows)) continue;
    rows.forEach((r, i) => add("places", `air quality ${key} band ${i + 1}`, r.category, r.guidance));
  }

  for (const q of STARTER_JOURNEY) add("journey", `first step ${q.id}`, q.title, q.why, q.action);
  for (const n of NUTRIENTS) add("journey", `nutrient ${n.key}`, n.label);
  for (const list of [produceTiers.watch_list, produceTiers.lower_typical] as { item: string; note: string }[][]) {
    for (const p of list) add("journey", `produce ${p.item}`, p.item, p.note);
  }

  for (const [kind, label] of Object.entries(KIND_LABEL)) add("wisdom", `wisdom kind ${kind}`, label);
  for (const w of WISDOM) add("wisdom", `wisdom ${w.id}`, w.text, w.attribution);
  for (const g of GUIDELINES) add("wisdom", `guideline ${g.id}`, g.text, g.authority);

  for (const [tier, t] of Object.entries(TIER_INFO)) add("lessons", `tier ${tier}`, t.label, t.blurb);
  for (const [id, t] of Object.entries(TOOL_INFO)) add("lessons", `tool ${id}`, t.title, t.blurb);
  for (const l of LESSONS) {
    add("lessons", `lesson ${l.id} title`, l.title);
    add("lessons", `lesson ${l.id} headline`, l.headline);
    l.body.forEach((p, i) => add("lessons", `lesson ${l.id} paragraph ${i + 1}`, p));
    add("lessons", `lesson ${l.id} watch for`, l.watchFor);
    add("lessons", `lesson ${l.id} talk about`, l.talkAbout);
  }
  for (const c of CONCEPT_CHECKS) {
    add("checks", `question ${c.id} prompt`, c.prompt);
    c.options.forEach((o, i) => add("checks", `question ${c.id} option ${i + 1}`, o));
    add("checks", `question ${c.id} explanation`, c.explain);
  }

  for (const [id, m] of Object.entries(MODULE_INFO)) add("modules", `module ${id}`, m.title, m.blurb);
  for (const l of MODULE_LESSONS) {
    add("modules", `elective ${l.id} title`, l.title);
    add("modules", `elective ${l.id} headline`, l.headline);
    l.body.forEach((p, i) => add("modules", `elective ${l.id} paragraph ${i + 1}`, p));
    add("modules", `elective ${l.id} watch for`, l.watchFor);
    add("modules", `elective ${l.id} talk about`, l.talkAbout);
  }
  for (const c of MODULE_CHECKS) {
    add("module_checks", `question ${c.id} prompt`, c.prompt);
    c.options.forEach((o, i) => add("module_checks", `question ${c.id} option ${i + 1}`, o));
    add("module_checks", `question ${c.id} explanation`, c.explain);
  }

  for (const p of PILLARS) add("pillars", `pillar ${p.key}`, p.title, p.tagline);
  for (const l of PILLAR_LESSONS) add("pillars", `audio lesson ${l.id}`, l.title, l.script);

  for (const e of evidenceData as unknown as EvidenceText[]) {
    add("reference", `research ${e.id} study type`, e.study_type);
    add("reference", `research ${e.id} evidence level`, e.evidence_level);
    add("evidence", `research ${e.id} headline`, e.headline);
    add("evidence", `research ${e.id} short summary`, e.summary_short);
    e.summary_detail.split("\n\n").forEach((p, i) => add("evidence", `research ${e.id} summary paragraph ${i + 1}`, p));
    e.key_findings.forEach((t, i) => add("evidence", `research ${e.id} finding ${i + 1}`, t));
    e.limitations.forEach((t, i) => add("evidence", `research ${e.id} limitation ${i + 1}`, t));
    e.practical.forEach((t, i) => add("evidence", `research ${e.id} practical ${i + 1}`, t));
  }

  return out;
}
