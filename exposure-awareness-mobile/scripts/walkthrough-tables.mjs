#!/usr/bin/env node
// Prints the "continued use" tables for the walkthrough: what each simulated person's picture looked like on days 1, 2, 7, 14,
// 30, 60 and 84 of using the app, straight from the JSON `npm run sim` wrote. Nothing here is typed in by hand.
//
//   node scripts/walkthrough-tables.mjs [dir]        (default: $SIM_OUT or ./.sim-out)
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2] ?? process.env.SIM_OUT ?? ".sim-out";
const PERSONAS = ["mina", "marcus", "elena", "priya"];
const DAYS = [1, 2, 7, 14, 30, 60, 84];
// the app shows no number until the picture is at least this filled in (NUMBER_MIN_COVERAGE in engine/wellnessScore.ts)
const NUMBER_MIN_COVERAGE = 20;

const BAND = { building: "Building", steady: "Steady", strong: "Strong", excellent: "Excellent" }; // BAND_INFO in engine/wellnessScore.ts
const part = (r, k) => (r.confidence[k] > 0 ? String(Math.round(r.components[k])) : "·");
const score = (r) => (r.coverage >= NUMBER_MIN_COVERAGE ? String(r.wellness) : "—");
const bandOf = (r) => (r.provisional ? "Early picture" : BAND[r.band] ?? r.band);

for (const id of PERSONAS) {
  const file = path.join(dir, `${id}.json`);
  if (!fs.existsSync(file)) continue;
  const run = JSON.parse(fs.readFileSync(file, "utf8"));
  const b = run.baseline;
  const rows = b.rows;
  const engaged = rows.filter((r) => r.engaged).length;
  const counts = b.final.counts;
  const events = b.events.reduce((m, e) => ({ ...m, [e.type]: (m[e.type] ?? 0) + 1 }), {});
  const last = rows[rows.length - 1];

  console.log(`### ${b.label}\n`);
  console.log(`Opened the app on ${engaged} of ${rows.length} days. Logged ${counts.food} meals, ${counts.practices} habit entries, ${counts.air_quality} air readings and ${counts.biomarkers} biomarkers; scanned ${events.scan ?? 0} products; read ${events.lesson ?? 0} lessons and answered ${events.recall ?? 0} recall questions; answered ${events.place_answer ?? 0} questions about ${last.places.compared > 0 ? "their places" : "no places"}.\n`);
  console.log("| Day | Score | Reading | Picture filled in | Exposure | Habits | Validation | Shelf | Places | Understanding | Curriculum | Recall (right of read) | Plant | This week's focus |");
  console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const d of DAYS) {
    const r = rows[Math.min(d, rows.length) - 1];
    console.log(
      `| ${d} | ${score(r)} | ${bandOf(r)} | ${r.coverage}% | ${part(r, "exposure")} | ${part(r, "resilience")} | ${part(r, "validation")} | ${part(r, "shelf")} | ${part(r, "places")} | ${part(r, "learning")} | ${r.literacyPct}% | ${r.recall.available > 0 ? `${r.recall.recalled} of ${r.recall.available}` : "·"} | ${r.plant} | ${r.focus.length} item${r.focus.length === 1 ? "" : "s"} |`
    );
  }
  console.log("");
}
console.log("A dot (·) means the app has no evidence for that part yet. A dash (—) means the picture is under 20% filled in, so the app shows no number at all.");
