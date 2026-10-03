/**
 * Finds the English the app can show: every tr("..."), trn(n, "...", "...") and msg("...") in the code (the catalog keys), and
 * any prose still sitting in a screen outside them (a string that would stay English in every language).
 *
 * Used by src/i18n/i18n.test.ts, and on its own to see what is left:
 *
 *   node scripts/i18n-scan.js            # leftover prose, by file
 *   node scripts/i18n-scan.js --keys     # every key and where it is used
 */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const ROOT = path.join(__dirname, "..");

/** the props whose string values a person reads (or hears); everything else (style, testID, role) is code */
const TEXT_PROPS = new Set(["title", "accessibilityLabel", "accessibilityHint", "aria-label", "placeholder", "label", "teaser", "blurb", "text", "message", "unit", "sub", "caption", "kicker", "meta", "doneLabel", "continueLabel"]);

function listFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "locales") continue;
      listFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(full);
  }
  return out;
}

/** every app source file: src/ (minus the simulator, which only tests read) and App.tsx */
function appFiles() {
  return [path.join(ROOT, "App.tsx"), ...listFiles(path.join(ROOT, "src")).filter((f) => !f.includes(`${path.sep}sim${path.sep}`))];
}

/**
 * Files whose prose is content, reached through src/i18n/content.ts rather than tr() literals (and the i18n module itself,
 * whose strings are language names and English fallbacks). Their tr()/msg() keys are still collected.
 */
const CONTENT_FILES = new Set(["src/data/conceptChecks.ts", "src/data/curriculum.ts", "src/data/dailyValues.ts", "src/data/guidelines.ts", "src/data/literatureFallback.ts", "src/data/modules.ts", "src/data/pillars.ts", "src/data/placeChecks.ts", "src/data/starterJourney.ts", "src/data/wisdom.ts", "src/i18n/index.ts", "src/i18n/content.ts", "src/theme.ts"]);

const isStr = (n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);
const prose = (s) => /[A-Za-z]{2,}/.test(s) && (/\s/.test(s.trim()) || /^[A-Z][a-z]/.test(s) || /[.!?…]$/.test(s)) && !/^(https?:|mailto:|\.{0,2}\/)/.test(s);

function calleeName(call) {
  const c = call.expression;
  return ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : null;
}

function scanFile(file) {
  const text = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const keys = [];
  const leftovers = [];
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  /** a literal that is a translation key, or is code rather than text */
  function exempt(n) {
    const p = n.parent;
    if (!p) return true;
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p) || ts.isLiteralTypeNode(p)) return true;
    if (ts.isCallExpression(p)) {
      const name = calleeName(p);
      if (name === "tr" || name === "msg" || name === "trn" || name === "require") return true;
      if (p.expression.getText(sf).startsWith("console.")) return true;
    }
    if (ts.isNewExpression(p) && p.expression.getText(sf) === "Error") return true;
    if (ts.isPropertyAssignment(p) && p.name === n) return true;
    if (ts.isElementAccessExpression(p) && p.argumentExpression === n) return true;
    if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(p.operatorToken.kind)) return true;
    if (ts.isCaseClause(p)) return true;
    if (ts.isJsxAttribute(p)) return !TEXT_PROPS.has(p.name.getText(sf));
    if (ts.isJsxExpression(p) && p.parent && ts.isJsxAttribute(p.parent)) return !TEXT_PROPS.has(p.parent.name.getText(sf));
    return false;
  }

  /** a tr() outside every function runs once, when the module loads, and would stay in that language after a switch */
  const insideFunction = (n) => {
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isFunctionLike(p)) return true;
    }
    return false;
  };

  function visit(n) {
    if (ts.isCallExpression(n)) {
      const name = calleeName(n);
      if ((name === "tr" || name === "trn") && ts.isIdentifier(n.expression) && !insideFunction(n)) {
        leftovers.push({ file: rel, line: line(n), text: `${name}() at module level freezes the language it loads in: ${n.getText(sf).slice(0, 80)}` });
      }
      if ((name === "tr" || name === "msg") && n.arguments[0] && isStr(n.arguments[0]) && ts.isIdentifier(n.expression)) {
        keys.push({ key: n.arguments[0].text, file: rel, line: line(n) });
      }
      if (name === "trn" && ts.isIdentifier(n.expression) && n.arguments.length >= 3) {
        for (const a of [n.arguments[1], n.arguments[2]]) if (!isStr(a)) leftovers.push({ file: rel, line: line(n), text: `trn() needs literal forms: ${n.getText(sf).slice(0, 80)}` });
        if (isStr(n.arguments[2])) keys.push({ key: n.arguments[2].text, file: rel, line: line(n), plural: true });
      }
    }
    if (ts.isJsxText(n) && /[A-Za-z]{2,}/.test(n.text)) leftovers.push({ file: rel, line: line(n), text: n.text.trim().replace(/\s+/g, " ") });
    if (isStr(n) && prose(n.text) && !exempt(n)) leftovers.push({ file: rel, line: line(n), text: n.text });
    if (ts.isTemplateExpression(n)) {
      const literal = n.head.text + n.templateSpans.map((s) => s.literal.text).join(" ");
      if (prose(literal) && !exempt(n)) leftovers.push({ file: rel, line: line(n), text: n.getText(sf) });
    }
    ts.forEachChild(n, visit);
  }
  visit(sf);
  // `// i18n-ignore: why` keeps English on purpose on that line (text stored with an entry, say)
  const ignored = new Set(text.split("\n").map((l, i) => (l.includes("i18n-ignore") ? i + 1 : 0)).filter(Boolean));
  // `// i18n-ignore-file: why` at the top: a file the app never shows (test fixtures kept beside the code, say)
  if (text.includes("i18n-ignore-file")) return { keys, leftovers: [] };
  return { keys, leftovers: leftovers.filter((l) => !ignored.has(l.line)) };
}

function scan(files = appFiles()) {
  const keys = [];
  const leftovers = [];
  for (const f of files) {
    const r = scanFile(f);
    keys.push(...r.keys);
    const rel = path.relative(ROOT, f).split(path.sep).join("/");
    leftovers.push(...(CONTENT_FILES.has(rel) ? r.leftovers.filter((l) => /at module level/.test(l.text)) : r.leftovers));
  }
  return { keys, leftovers };
}

module.exports = { scan, scanFile, appFiles, listFiles, ROOT, TEXT_PROPS, CONTENT_FILES };

if (require.main === module) {
  const dirs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const files = appFiles().filter((f) => dirs.length === 0 || dirs.some((d) => path.relative(ROOT, f).startsWith(d)));
  const { keys, leftovers } = scan(files);
  if (process.argv.includes("--keys")) {
    for (const k of keys) console.log(`${k.file}:${k.line}\t${JSON.stringify(k.key)}`);
  } else {
    const byFile = {};
    for (const l of leftovers) (byFile[l.file] = byFile[l.file] || []).push(l);
    for (const [f, ls] of Object.entries(byFile)) {
      console.log(`\n${f} (${ls.length})`);
      for (const l of ls) console.log(`  ${l.line}: ${l.text.slice(0, 150)}`);
    }
    console.log(`\n${leftovers.length} leftover strings in ${Object.keys(byFile).length} files; ${new Set(keys.map((k) => k.key)).size} distinct keys`);
  }
}
