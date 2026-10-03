/**
 * Translation batches without retyping English keys (a typo in a key silently breaks a lookup).
 *
 *   I18N_TODO=.i18n-work/todo npx jest src/i18n/i18n.test.ts -t "writes the to-do"   # what each language still needs
 *   node scripts/i18n-batch.js freeze                      # snapshot the to-do into stable numbered lists
 *   node scripts/i18n-batch.js show <group> <from> <to>    # print numbered English strings
 *   node scripts/i18n-batch.js merge <lang> <group> <file> # merge {"<n>": "translation"} into the right catalog, with checks
 *   node scripts/i18n-batch.js status                      # progress per language and group
 *
 * Groups are "code" (the app's own text) and the content groups in src/i18n/content.ts. Work files live in .i18n-work/
 * (git-ignored). A merge refuses a batch whose {placeholders} differ from the English, and lists translations whose
 * length or end punctuation looks out of line with their source, which is how a misaligned batch shows itself.
 */
const fs = require("fs");
const path = require("path");
const APP = path.join(__dirname, "..");
const SP = path.join(APP, ".i18n-work");
const LOCALES = path.join(APP, "src/i18n/locales");
const LANGS = ["ko", "zh-Hans", "zh-Hant", "ja"];

const [cmd, ...args] = process.argv.slice(2);
const srcPath = (group) => path.join(SP, `source-${group}.json`);

function codeFileOf() {
  const { scan } = require(path.join(APP, "scripts/i18n-scan.js"));
  const map = new Map();
  for (const k of scan().keys) if (!map.has(k.key)) map.set(k.key, k.file);
  return map;
}

fs.mkdirSync(SP, { recursive: true });

if (cmd === "freeze") {
  const todo = JSON.parse(fs.readFileSync(path.join(SP, "todo/ko.json"), "utf8"));
  for (const [group, keys] of Object.entries(todo)) {
    // never renumber a frozen list: strings added to the app since are appended to its end
    const frozen = fs.existsSync(srcPath(group)) ? JSON.parse(fs.readFileSync(srcPath(group), "utf8")) : [];
    const added = keys.filter((k) => !frozen.includes(k));
    if (added.length === 0 && frozen.length > 0) continue;
    fs.writeFileSync(srcPath(group), JSON.stringify([...frozen, ...added], null, 1));
    console.log(`${frozen.length ? "appended to" : "froze"} ${group}: +${added.length} (now ${frozen.length + added.length})`);
  }
} else if (cmd === "show") {
  const [group, from, to] = args;
  const keys = JSON.parse(fs.readFileSync(srcPath(group), "utf8"));
  const a = Number(from), b = Math.min(Number(to), keys.length - 1);
  for (let i = a; i <= b; i++) console.log(`${i}\t${JSON.stringify(keys[i])}`);
  console.log(`[${group}: ${keys.length} total]`);
} else if (cmd === "merge") {
  const [lang, group, file] = args;
  const keys = JSON.parse(fs.readFileSync(srcPath(group), "utf8"));
  const batch = JSON.parse(fs.readFileSync(file, "utf8"));
  const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
  const ends = (s) => (/[?？]\s*$/.test(s) ? "?" : /[.。．:：]\s*$/.test(s) ? "." : "");
  const errors = [], warnings = [];
  const fileFor = group === "code" ? (() => { const m = codeFileOf(); return (k) => (m.get(k) || "").startsWith("src/engine/") ? "engine.json" : "ui.json"; })() : () => "content.json";
  const out = {};
  for (const [n, t] of Object.entries(batch)) {
    const en = keys[Number(n)];
    if (en === undefined) { errors.push(`#${n}: no such source`); continue; }
    if (typeof t !== "string" || !t.trim()) { errors.push(`#${n}: empty`); continue; }
    if (ph(en) !== ph(t)) errors.push(`#${n}: placeholders {${ph(en)}} vs {${ph(t)}}  EN: ${en.slice(0, 70)} | ${t.slice(0, 50)}`);
    const ratio = t.length / Math.max(1, en.length);
    if (en.length > 25 && (ratio < 0.12 || ratio > 1.6)) warnings.push(`#${n}: length ratio ${ratio.toFixed(2)}  EN: ${en.slice(0, 60)} | ${t.slice(0, 40)}`);
    if (en.length > 12 && ends(en) === "?" && ends(t) !== "?") warnings.push(`#${n}: English asks, translation doesn't  EN: ${en.slice(0, 60)} | ${t.slice(0, 40)}`);
    (out[fileFor(en)] = out[fileFor(en)] || {})[en] = t;
  }
  if (errors.length) { console.log("NOT MERGED:\n" + errors.join("\n")); process.exit(1); }
  for (const [f, entries] of Object.entries(out)) {
    const p = path.join(LOCALES, lang, f);
    const cur = JSON.parse(fs.readFileSync(p, "utf8"));
    Object.assign(cur, entries);
    const sorted = Object.fromEntries(Object.entries(cur).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    fs.writeFileSync(p, JSON.stringify(sorted, null, 1) + "\n");
    console.log(`${lang}/${f}: +${Object.keys(entries).length} (now ${Object.keys(sorted).length})`);
  }
  if (warnings.length) console.log("check:\n" + warnings.join("\n"));
} else if (cmd === "status") {
  const all = {};
  for (const lang of LANGS) {
    const cat = Object.assign({}, ...fs.readdirSync(path.join(LOCALES, lang)).map((f) => JSON.parse(fs.readFileSync(path.join(LOCALES, lang, f), "utf8"))));
    for (const f of fs.readdirSync(SP).filter((x) => x.startsWith("source-"))) {
      const g = f.slice(7, -5);
      const keys = JSON.parse(fs.readFileSync(path.join(SP, f), "utf8"));
      (all[g] = all[g] || {})[lang] = `${keys.filter((k) => k in cat).length}/${keys.length}`;
    }
  }
  console.table(all);
}
