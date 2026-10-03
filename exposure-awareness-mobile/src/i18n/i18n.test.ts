/**
 * The app's languages. The runtime (which language a device gets, placeholders, plurals, dates, lists), and every catalog held to
 * every string the app can show: complete, not stale, the same {placeholders}, and no fear vocabulary a translation adds that
 * the English doesn't have.
 *
 * To list what a language still needs, by group: I18N_TODO=/tmp/todo npx jest src/i18n/i18n.test.ts -t "writes the to-do"
 */
import * as fs from "fs";
import * as path from "path";
import { getLanguage, languageOf, listWords, loadCatalog, READY, resolveLanguage, setLanguage, TRANSLATED, tr, trn, weekdayNarrow, weekdayShort, type Lang } from "./index";
import { contentStrings, type ContentGroup } from "./content";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { scan } = require("../../scripts/i18n-scan.js") as { scan: () => { keys: { key: string; file: string; line: number }[]; leftovers: { file: string; line: number; text: string }[] } };

afterEach(() => setLanguage("en"));

describe("which language a device gets", () => {
  const loc = (languageTag: string, extra: Partial<{ languageCode: string; languageScriptCode: string | null; regionCode: string | null }> = {}) => ({ languageTag, ...extra });
  test.each([
    [[loc("ko-KR", { languageCode: "ko" })], "ko"],
    [[loc("ja-JP", { languageCode: "ja" })], "ja"],
    [[loc("zh-Hans-CN", { languageCode: "zh", languageScriptCode: "Hans" })], "zh-Hans"],
    [[loc("zh-Hant-TW", { languageCode: "zh", languageScriptCode: "Hant" })], "zh-Hant"],
    [[loc("zh-TW")], "zh-Hant"],
    [[loc("zh-HK")], "zh-Hant"],
    [[loc("zh-MO")], "zh-Hant"],
    [[loc("zh_TW")], "zh-Hant"],
    [[loc("zh-CN")], "zh-Hans"],
    [[loc("zh-SG")], "zh-Hans"],
    [[loc("zh")], "zh-Hans"],
    [[loc("zh-Hant-HK")], "zh-Hant"],
    [[loc("fr-FR"), loc("ja-JP")], "ja"],
    [[loc("en-GB"), loc("ko-KR")], "en"],
    [[loc("fr-FR"), loc("de-DE")], "en"],
    [[], "en"],
  ] as [ReturnType<typeof loc>[], Lang][])("%j -> %s", (locales, expected) => {
    expect(languageOf(locales, ["en", ...TRANSLATED])).toBe(expected);
  });

  test("a language still being written is never chosen: its device gets the next ready language, then English", () => {
    for (const lang of TRANSLATED.filter((l) => !READY.includes(l))) {
      expect(languageOf([loc(lang === "zh-Hans" ? "zh-CN" : lang === "zh-Hant" ? "zh-TW" : lang)])).toBe("en");
      expect(resolveLanguage(lang)).not.toBe(lang);
    }
  });
});

describe("looking up and filling in", () => {
  test("English is its own catalog; placeholders fill; an unknown one stays visible rather than vanishing", () => {
    expect(tr("Your week")).toBe("Your week");
    expect(tr("{a} of {b}", { a: 2, b: 5 })).toBe("2 of 5");
    expect(tr("{a} of {b}", { a: 2 })).toBe("2 of {b}");
  });

  test("a string with no translation yet shows in English, not as a key", () => {
    setLanguage("ko");
    expect(tr("A sentence no catalog will ever have, 8f3a")).toBe("A sentence no catalog will ever have, 8f3a");
  });

  test("English plurals choose by count; the other languages have one form, keyed by the plural", () => {
    expect(trn(1, "{n} lesson", "{n} lessons")).toBe("1 lesson");
    expect(trn(3, "{n} lesson", "{n} lessons")).toBe("3 lessons");
    expect(trn(0, "{n} lesson", "{n} lessons")).toBe("0 lessons");
    for (const lang of TRANSLATED) {
      setLanguage(lang);
      const catalog = loadCatalog(lang);
      if (catalog["{n} lessons"]) {
        expect(trn(1, "{n} lesson", "{n} lessons")).toBe(catalog["{n} lessons"].replace("{n}", "1"));
      }
    }
  });

  test("weekdays come from the calendar date alone, in each language", () => {
    // 2026-10-05 is a Monday
    expect(weekdayShort("2026-10-05")).toBe("Mon");
    expect(weekdayNarrow("2026-10-05")).toBe("M");
    setLanguage("ko");
    expect(weekdayShort("2026-10-05")).toBe("월");
    setLanguage("ja");
    expect(weekdayShort("2026-10-05")).toBe("月");
    setLanguage("zh-Hans");
    expect(weekdayShort("2026-10-05")).toBe("周一");
    setLanguage("zh-Hant");
    expect(weekdayShort("2026-10-05")).toBe("週一");
  });

  test("lists join the way each language joins them", () => {
    expect(listWords(["radon", "lead", "smoke"])).toBe("radon, lead and smoke");
    expect(listWords(["radon"])).toBe("radon");
    setLanguage("ko");
    expect(listWords(["라돈", "납"])).toBe("라돈 및 납");
    setLanguage("ja");
    expect(listWords(["ラドン", "鉛", "煙"])).toBe("ラドン、鉛、煙");
    setLanguage("zh-Hans");
    expect(listWords(["氡", "铅", "烟"])).toBe("氡、铅和烟");
  });

  test("switching languages and back leaves English exactly as it was", () => {
    setLanguage("ja");
    expect(getLanguage()).toBe("ja");
    setLanguage("en");
    expect(tr("Your week")).toBe("Your week");
  });
});

describe("the code says everything through tr()", () => {
  test("no prose sits in a screen, a component or the engine outside tr(), trn() or msg(), and no tr() runs at module load", () => {
    expect(scan().leftovers).toEqual([]);
  });
});

// ---- the catalogs -------------------------------------------------------------------------------------------------------------

const codeKeys = [...new Set(scan().keys.map((k) => k.key))];
const content = contentStrings();
const contentKeys = [...new Set(content.map((c) => c.key))];
const allKeys = new Set([...codeKeys, ...contentKeys]);
const groupOf = new Map<string, ContentGroup>();
for (const c of content) if (!groupOf.has(c.key)) groupOf.set(c.key, c.group);

/**
 * The content groups each language is held to in full. Every group is listed once its translation is written; the code's own
 * strings (screens, engine, notifications) are always held in full.
 */
const REQUIRED_GROUPS: Record<Exclude<Lang, "en">, ContentGroup[]> = {
  ko: [],
  "zh-Hans": [],
  "zh-Hant": [],
  ja: [],
};

/** Names, abbreviations and units that read the same in every language. */
const SAME_IN_EVERY_LANGUAGE = new Set(["Exposure Awareness", "HbA1c", "HRV", "VO2max", "kcal", "PFAS", "BPA", "PM2.5", "PM10", "GHS", "NOVA", "QSAR", "PBPK", "PubMed ›", "DOI ›", "PubMed: {title}", "DOI: {title}"]);

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const LOCALE_DIR = path.join(__dirname, "locales");
const filesOf = (lang: string) => fs.readdirSync(path.join(LOCALE_DIR, lang)).filter((f) => f.endsWith(".json"));

for (const lang of TRANSLATED) {
  describe(`${lang} catalog`, () => {
    const catalog = loadCatalog(lang);

    test("no key is in two of its files, and no translation is empty", () => {
      const seen = new Map<string, string>();
      const dupes: string[] = [];
      for (const file of filesOf(lang)) {
        const entries = JSON.parse(fs.readFileSync(path.join(LOCALE_DIR, lang, file), "utf8")) as Record<string, string>;
        for (const [k, v] of Object.entries(entries)) {
          if (seen.has(k)) dupes.push(`${k} (${seen.get(k)} and ${file})`);
          seen.set(k, file);
          if (typeof v !== "string" || !v.trim()) dupes.push(`empty: ${k}`);
        }
      }
      expect(dupes).toEqual([]);
    });

    test("nothing stale: every key is something the app still shows", () => {
      expect(Object.keys(catalog).filter((k) => !allKeys.has(k))).toEqual([]);
    });

    test(READY.includes(lang) ? "every string in the code is translated (a ready language)" : "still being written: not offered until every string in the code is translated", () => {
      const missing = codeKeys.filter((k) => !(k in catalog));
      if (READY.includes(lang)) expect(missing).toEqual([]);
      else expect(READY).not.toContain(lang);
    });

    test("every required content group is translated", () => {
      const required = new Set(REQUIRED_GROUPS[lang]);
      expect(contentKeys.filter((k) => required.has(groupOf.get(k)!) && !(k in catalog))).toEqual([]);
    });

    test("each translation keeps the English placeholders, exactly", () => {
      const off = Object.entries(catalog)
        .filter(([en, t]) => placeholders(en).join() !== placeholders(t).join())
        .map(([en, t]) => `${en} => ${t}`);
      expect(off).toEqual([]);
    });

    test("a translation is not the English left in place (names, abbreviations and units aside)", () => {
      const same = Object.entries(catalog)
        .filter(([en, t]) => en === t && /[A-Za-z]{3,}/.test(en) && !SAME_IN_EVERY_LANGUAGE.has(en))
        .map(([en]) => en);
      expect(same).toEqual([]);
    });

    test("calm in every language: a translation adds no alarm the English doesn't have", () => {
      const rules = CALM_RULES[lang];
      const added: string[] = [];
      for (const [en, t] of Object.entries(catalog)) {
        for (const [word, allowedIf] of rules) {
          if (t.includes(word) && !allowedIf.test(en)) added.push(`"${word}" in: ${t.slice(0, 80)}  <=  ${en.slice(0, 80)}`);
        }
        if (/[!！]/.test(t) && !/!/.test(en)) added.push(`exclamation in: ${t.slice(0, 80)}`);
      }
      expect(added).toEqual([]);
    });
  });
}

/**
 * Words that carry alarm in each language, and the English that would justify them. "위험" can translate "risk" (as in the risk
 * translator) or an official category name the English quotes; it cannot appear in a sentence the English wrote calmly.
 */
const RISK = /\b(risks?|risky|danger|dangerous|hazards?|hazardous|unsafe)\b/i;
const TOXIC = /tox|poison/i;
const HARM = /harm|hazard|adverse/i;
const LETHAL = /lethal|fatal|deadly|mortality|death|die/i;
const BAD = /\bbad\b|worse|worst|\bpoor/i;
const FEAR = /fear|scar|afraid|anxi|alarm|panic|frighten|worr/i;
const WARN = /warn/i;
const CALM_RULES: Record<Exclude<Lang, "en">, [string, RegExp][]> = {
  ko: [["위험", RISK], ["독성", TOXIC], ["유독", TOXIC], ["유해", HARM], ["치명", LETHAL], ["사망", LETHAL], ["나쁜", BAD], ["나쁨", BAD], ["공포", FEAR], ["무서", FEAR], ["불안", FEAR], ["경고", WARN]],
  ja: [["危険", RISK], ["危な", RISK], ["リスク", RISK], ["毒性", TOXIC], ["有毒", TOXIC], ["有害", HARM], ["致命", LETHAL], ["死亡", LETHAL], ["悪い", BAD], ["恐怖", FEAR], ["怖", FEAR], ["不安", FEAR], ["警告", WARN]],
  "zh-Hans": [["危险", RISK], ["风险", RISK], ["毒性", TOXIC], ["有毒", TOXIC], ["有害", HARM], ["致命", LETHAL], ["死亡", LETHAL], ["坏", BAD], ["恐惧", FEAR], ["可怕", FEAR], ["焦虑", FEAR], ["警告", WARN]],
  "zh-Hant": [["危險", RISK], ["風險", RISK], ["毒性", TOXIC], ["有毒", TOXIC], ["有害", HARM], ["致命", LETHAL], ["死亡", LETHAL], ["壞", BAD], ["恐懼", FEAR], ["可怕", FEAR], ["焦慮", FEAR], ["警告", WARN]],
};

test("writes the to-do list of untranslated strings, by language and group (only when I18N_TODO is set)", () => {
  const out = process.env.I18N_TODO;
  if (!out) return;
  fs.mkdirSync(out, { recursive: true });
  for (const lang of TRANSLATED) {
    const catalog = loadCatalog(lang);
    const todo: Record<string, string[]> = { code: codeKeys.filter((k) => !(k in catalog)) };
    for (const c of content) {
      if (c.key in catalog || allKeysAlreadyListed(todo, c.key)) continue;
      (todo[c.group] = todo[c.group] ?? []).push(c.key);
    }
    fs.writeFileSync(path.join(out, `${lang}.json`), JSON.stringify(todo, null, 1));
  }
});

function allKeysAlreadyListed(todo: Record<string, string[]>, key: string) {
  return Object.values(todo).some((list) => list.includes(key));
}
