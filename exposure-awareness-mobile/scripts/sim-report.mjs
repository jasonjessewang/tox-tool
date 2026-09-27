#!/usr/bin/env node
// Reads the JSON that `npm run sim` wrote and prints what the engine did over the simulated weeks,
// then checks the properties the engine soak run established. Exits non-zero if any check fails, so
// it can guard a change the same way the unit tests do.
//
//   node scripts/sim-report.mjs [dir]        (default: $SIM_OUT or ./.sim-out)
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2] ?? process.env.SIM_OUT ?? ".sim-out";
const PERSONAS = ["mina", "marcus", "elena", "priya"];
const read = (name) => {
  const file = path.join(dir, name);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
};

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = (xs) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));
const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0);
const source = (tipKey) => tipKey.split(":")[0];

const checks = [];
const check = (ok, what, detail = "") => checks.push({ ok, what, detail });

console.log(`Engine soak report -- ${dir}\n`);

const twin = { claims: 0, decided: 0 };
for (const id of PERSONAS) {
  const run = read(`${id}.json`);
  if (!run) {
    console.log(`${id}: no results (run \`npm run sim\` first)\n`);
    continue;
  }
  const b = run.baseline;
  const rows = b.rows;
  const writes = Object.values(b.audit.writes);
  const stamped = writes.reduce((n, w) => n + w.n, 0);
  const wrongDay = writes.reduce((n, w) => n + w.mismatched, 0);
  const morning = rows.filter((r) => r.streakMorning !== null);
  const falseZero = morning.filter((r) => r.streakMorning === 0 && (r.streakMorningTrue ?? 0) > 0).length;
  // Quiet is right when the person has decided to keep what is on the list; it is a fault only when nothing was kept.
  const emptyLoaded = rows.filter((r) => r.focus.length === 0 && r.shelfIndex >= 10 && (r.kept ?? 0) === 0).length;
  const focusDays = (fn) => rows.filter((r) => r.focus.length > 0 && fn(r)).length;
  const fromShelf = focusDays((r) => (r.focusOrigin ?? []).includes("shelf"));
  const fromPlaces = focusDays((r) => (r.focusOrigin ?? []).includes("places"));
  // A substance that stands on the shelf or in a place is one decision: it never takes two seats in Focus.
  const dupShelf = rows.filter((r) => {
    const standingKeys = r.focus.filter((_, i) => ["shelf", "places"].includes((r.focusOrigin ?? [])[i])).map(source);
    return new Set(standingKeys).size < standingKeys.length;
  }).length;
  // Places: what the person told the app, and whether it reached the score and the advice.
  const placeEvents = b.events.filter((e) => ["place_answer", "place_fix", "household"].includes(e.type));
  const answers = b.events.filter((e) => e.type === "place_answer").length;
  const fixes = b.events.filter((e) => e.type === "place_fix");
  const badFixes = fixes.filter((e) => e.data.after < e.data.before - 0.5).length;
  const wrongPart = placeEvents.filter((e) => e.data?.key !== "places").length;
  const last = rows[rows.length - 1];
  // Recall: the questions after the lessons. Answers only ever add to the Understanding part, and only ever ask about what was read.
  const recallEvents = b.events.filter((e) => e.type === "recall");
  const lessonDay = new Map(b.events.filter((e) => e.type === "lesson").map((e) => [e.detail, e.day]));
  const recallLowered = recallEvents.filter((e) => e.data.after < e.data.before - 0.001).length;
  const recallWrongPart = recallEvents.filter((e) => e.data.key !== "learning").length;
  const recallUnread = recallEvents.filter((e) => !(lessonDay.has(e.data.lesson) && lessonDay.get(e.data.lesson) <= e.day)).length;
  const recallRight = recallEvents.filter((e) => e.data.correct === 1).length;
  const understandingFalls = rows.slice(1).filter((r, i) => r.components.learning < rows[i].components.learning - 0.5).length;
  const understandingBelowReading = rows.filter((r) => r.components.learning < r.literacyPct - 1).length;
  const understandingBonusMax = Math.max(0, ...rows.map((r) => r.components.learning - r.literacyPct));
  const attentionDays = rows.filter((r) => r.places.attention > 0).length;
  // The very first reading (no evidence before it) is not a "jump": there was nothing to move from.
  const worstPlacesJump = Math.max(0, ...placeEvents.filter((e) => e.data.beforeConfidence > 0).map((e) => Math.abs(e.data.after - e.data.before)));
  let longest = 0;
  let cur = 0;
  let prev = null;
  for (const r of rows) {
    const top = r.focus[0] ?? null;
    cur = top !== null && top === prev ? cur + 1 : top !== null ? 1 : 0;
    prev = top;
    longest = Math.max(longest, cur);
  }
  const wellness = rows.map((r) => r.wellness);
  // Day-to-day movement of the score, once the picture is filled in enough to trust (early readings are labelled as such).
  const steady = rows.slice(1).map((r, i) => [rows[i], r]).filter(([a, b]) => !a.provisional && !b.provisional);
  const dayMoves = steady.map(([a, b]) => Math.abs(b.wellness - a.wellness));
  const weekMoves = rows.slice(7).map((r, i) => [rows[i], r]).filter(([a, b]) => !a.provisional && !b.provisional).map(([a, b]) => Math.abs(b.wellness - a.wellness));
  const provisionalDays = rows.filter((r) => r.provisional).length;
  const maxDay = Math.max(0, ...dayMoves);
  const maxWeek = Math.max(0, ...weekMoves);
  // Retiring a product (with nothing new scanned the same day) must never lower the shelf part.
  const retireDays = new Set(b.events.filter((e) => e.type === "retire").map((e) => e.day));
  const scanDays = new Set(b.events.filter((e) => e.type === "scan").map((e) => e.day));
  const retireDrops = [...retireDays].filter((d) => d > 0 && !scanDays.has(d) && rows[d].components.shelf < rows[d - 1].components.shelf - 0.5).length;
  const shelfFloor = rows.filter((r) => r.shelfItems >= 3 && r.components.shelf <= 5).length;
  const label = (arm) => {
    const c = { improving: 0, worsening: 0, flat: 0, not_enough_data: 0 };
    for (const r of run[arm].rows) c[r.scoreTrend] = (c[r.scoreTrend] ?? 0) + 1;
    return c;
  };
  for (const arm of ["thorough", "sparse"]) {
    const c = label(arm);
    twin.claims += c.improving + c.worsening;
    twin.decided += c.improving + c.worsening + c.flat;
  }

  console.log(`${b.label}  [${b.tz}]`);
  console.log(`  entries stamped on the wrong calendar day: ${wrongDay}/${stamped}   morning-open streak reading 0 when it was live: ${falseZero}/${morning.length}`);
  console.log(`  wellness ${Math.round(mean(wellness))} +/- ${Math.round(sd(wellness))} (range ${Math.min(...wellness)}-${Math.max(...wellness)});  shelf index end ${rows[rows.length - 1].shelfIndex}, ${rows[rows.length - 1].shelfItems} items`);
  console.log(`  score movement (picture trusted): mean ${mean(dayMoves).toFixed(2)} points a day, at most ${maxDay} in a day and ${maxWeek} in a week; ${provisionalDays} early-reading days; picture ${rows[rows.length - 1].coverage}% filled in at the end`);
  console.log(`  Focus: empty ${rows.filter((r) => r.focus.length === 0).length}d (of which unexplained by a kept decision while the shelf carries load: ${emptyLoaded}d), from the shelf ${fromShelf}d, repeated shelf substance ${dupShelf}d, longest unchanged #1 ${longest}d, most kept at once ${Math.max(...rows.map((r) => r.kept ?? 0))}`);
  console.log(`  Places: ${answers} answers given, ${fixes.length} fixes made; at the end ${last.places.compared} compared (${last.places.meets} meet, ${last.places.attention} worth a look, ${last.places.unanswered} unanswered); part ${last.components.places} at ${Math.round(100 * (last.confidence.places ?? 0))}% evidence; Focus drew on places ${fromPlaces}d`);
  console.log(`  Recall: ${recallEvents.length} questions answered (${recallRight} right the first time round), ${last.recall.recalled} of ${last.recall.available} on the lessons read answered right at least once, ${last.recall.due} due; Understanding ${Math.round(last.components.learning)} against ${last.literacyPct}% through the curriculum`);
  console.log(`  events: ${Object.entries(b.events.reduce((m, e) => ({ ...m, [e.type]: (m[e.type] ?? 0) + 1 }), {})).map(([k, v]) => `${k} ${v}`).join(", ")}\n`);

  check(wrongDay === 0, `${id}: every entry is stamped with the person's own calendar day`, `${wrongDay}/${stamped} wrong`);
  check(falseZero === 0, `${id}: the streak never reads 0 on a morning when it is still alive`, `${falseZero}/${morning.length}`);
  check(emptyLoaded === 0, `${id}: advice does not go quiet while the shelf carries load`, `${emptyLoaded} days`);
  check(dupShelf === 0, `${id}: Focus never repeats a substance from the shelf or the places`, `${dupShelf} days`);
  check(answers === 0 || ((last.confidence.places ?? 0) > 0 && last.components.places > 0), `${id}: what the person told the app about their places reaches the score`, `${answers} answers, evidence ${last.confidence.places}`);
  check(wrongPart === 0, `${id}: every places receipt is about the Places part`, `${wrongPart} not`);
  check(badFixes === 0, `${id}: fixing something in a place never lowers the Places part`, `${badFixes}/${fixes.length}`);
  check(worstPlacesJump <= 30, `${id}: once it has a first reading, no single answer or housemate moves the Places part more than 30 points`, `largest ${Math.round(worstPlacesJump)}`);
  check(attentionDays < 10 || fromPlaces > 0 || Math.max(...rows.map((r) => r.kept ?? 0)) > 0, `${id}: advice from the places reaches Focus (unless the person kept everything)`, `${attentionDays} days with something worth a look, Focus from places ${fromPlaces}d`);
  check(maxDay <= 12, `${id}: the score never jumps more than 12 points in a day once the picture is trusted`, `largest ${maxDay}`);
  check(maxWeek <= 20, `${id}: the score never moves more than 20 points in a week once the picture is trusted`, `largest ${maxWeek}`);
  check(recallLowered === 0, `${id}: no answer to a question ever lowers the Understanding part`, `${recallLowered}/${recallEvents.length}`);
  check(recallWrongPart === 0, `${id}: every recall receipt is about the Understanding part`, `${recallWrongPart} not`);
  check(recallUnread === 0, `${id}: questions are only asked about lessons that were already read`, `${recallUnread} asked early`);
  check(understandingFalls === 0, `${id}: the Understanding part never falls from one day to the next`, `${understandingFalls} days`);
  check(understandingBelowReading === 0 && understandingBonusMax <= 21, `${id}: recall adds to the curriculum share and never more than its cap`, `largest addition ${understandingBonusMax.toFixed(1)}`);
  check(recallRight === 0 || last.components.learning > last.literacyPct || last.components.learning >= 99.5, `${id}: answers given right reach the Understanding part`, `${recallRight} right answers`);
  check(retireDrops === 0, `${id}: retiring a product never lowers the shelf part`, `${retireDrops} times`);
  check(shelfFloor === 0, `${id}: the shelf part never sits on its floor while there are products to read`, `${shelfFloor} days`);
}

if (twin.decided > 0) {
  check(pct(twin.claims, twin.decided) <= 15, "trend labels: users whose behaviour never changed are not told they are improving or worsening", `${twin.claims}/${twin.decided} decided days (${pct(twin.claims, twin.decided)}%)`);
  console.log(`Trend pill, behaviour unchanged (logging-thoroughness twins): ${twin.claims}/${twin.decided} decided days named a direction (${pct(twin.claims, twin.decided)}%)\n`);
}

const conc = read("concurrency.json");
if (conc) {
  console.log(`Concurrent writes: ${conc.locked}/${conc.N} kept with the per-key lock (an unlocked read-modify-write kept ${conc.unlocked}/${conc.N}); mixed insert/delete ${conc.mixed.got}/${conc.mixed.expected}; daily numbers ${conc.metrics.got}/${conc.metrics.expected}`);
  check(conc.locked === conc.N && conc.mixed.got === conc.mixed.expected && conc.metrics.got === conc.metrics.expected, "concurrent writes never lose an entry");
}
const kc = read("knowledge_change.json");
if (kc) {
  console.log(`Knowledge change (current database vs one without bisphenol analogs / phenoxyethanol): ${kc.changed.length} products change stance or gain a flag; shelf index shifts ${kc.ledgerDiff.map((d) => `${d.persona} ${d.indexBefore}->${d.indexAfter}`).join(", ")}`);
}
const scaling = read("scaling.json");
if (scaling) {
  console.log(`Dashboard-load reads as history grows: ${scaling.map((s) => `${s.days}d/${s.entries} entries: wellness ${s.ms.wellness}ms, fusion ${s.ms.fusion}ms`).join("; ")}`);
  const worst = Math.max(...scaling.flatMap((s) => Object.values(s.ms)));
  check(worst < 2000, "engine reads stay under 2 s even with two years of history", `slowest ${worst} ms`);
}

console.log("\nChecks");
for (const c of checks) console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.what}${c.detail ? `  (${c.detail})` : ""}`);
const failed = checks.filter((c) => !c.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
