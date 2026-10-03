/**
 * The app's languages: English, plus Korean, Simplified Chinese, Traditional Chinese and Japanese.
 *
 * A string is looked up by its English text, gettext-style: `tr("Your week")`. The code stays readable, a string with no
 * translation yet shows in English rather than as a key, and src/i18n/i18n.test.ts holds every catalog to every string the app
 * can show, to the same {placeholders}, and to the calm-vocabulary rules in each language. Lessons, substance pages and the other
 * content go through the same `tr` where they are shown, so the data files keep one English source and a changed English
 * sentence shows in English until its translation is redone, instead of an out-of-date translation staying up.
 *
 * Everything is in memory and on the device: choosing a language sends nothing anywhere.
 */
import { Platform } from "react-native";
import { getLocales } from "expo-localization";

export type Lang = "en" | "ko" | "zh-Hans" | "zh-Hant" | "ja";
export type LanguagePreference = "system" | Lang;

/** each language named in itself, the way a language picker should show it */
export const LANGUAGES: { id: Lang; native: string }[] = [
  { id: "en", native: "English" },
  { id: "ko", native: "한국어" },
  { id: "zh-Hans", native: "简体中文" },
  { id: "zh-Hant", native: "繁體中文" },
  { id: "ja", native: "日本語" },
];

export const TRANSLATED: Exclude<Lang, "en">[] = ["ko", "zh-Hans", "zh-Hant", "ja"];

/**
 * The languages a person can be shown: English, plus each translation once every string in the app's own text is in its
 * catalog (src/i18n/i18n.test.ts holds a language listed here to that). A language still being written stays out of the
 * picker and is never picked from the device, so nobody meets a screen half in one language and half in another.
 */
export const READY: Lang[] = ["en"];

type Catalog = Record<string, string>;
type Vars = Record<string, string | number>;

/* eslint-disable @typescript-eslint/no-require-imports */
const LOADERS: Record<Exclude<Lang, "en">, () => Catalog[]> = {
  ko: () => [require("./locales/ko/ui.json"), require("./locales/ko/engine.json"), require("./locales/ko/content.json")],
  "zh-Hans": () => [require("./locales/zh-Hans/ui.json"), require("./locales/zh-Hans/engine.json"), require("./locales/zh-Hans/content.json")],
  "zh-Hant": () => [require("./locales/zh-Hant/ui.json"), require("./locales/zh-Hant/engine.json"), require("./locales/zh-Hant/content.json")],
  ja: () => [require("./locales/ja/ui.json"), require("./locales/ja/engine.json"), require("./locales/ja/content.json")],
};
/* eslint-enable @typescript-eslint/no-require-imports */

/** a language's catalog files merged into one lookup table (the test checks no key is in two files) */
export function loadCatalog(lang: Exclude<Lang, "en">): Catalog {
  return Object.assign({}, ...LOADERS[lang]());
}

let current: Lang = "en";
let catalog: Catalog = {};
const listeners = new Set<(lang: Lang) => void>();

function fill(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

/** the English text, in the current language; `{name}` placeholders are filled from `vars` */
export function tr(english: string, vars?: Vars): string {
  return fill(current === "en" ? english : (catalog[english] ?? english), vars);
}

/**
 * A count with a singular and a plural English form. Korean, Chinese and Japanese have one form, keyed by the plural. `{n}` is
 * the count unless `vars` says otherwise.
 */
export function trn(count: number, one: string, other: string, vars?: Vars): string {
  const all = { n: count, ...vars };
  if (current === "en") return fill(count === 1 ? one : other, all);
  return fill(catalog[other] ?? (count === 1 ? one : other), all);
}

/** marks English text to translate later, where it is shown (a label in a constant, say); returns it unchanged, type and all */
export function msg<T extends string>(english: T): T {
  return english;
}

export function getLanguage(): Lang {
  return current;
}

const DEFAULT_TAG: Record<Lang, string> = { en: "en-US", ko: "ko-KR", "zh-Hans": "zh-Hans", "zh-Hant": "zh-Hant", ja: "ja-JP" };

/** the tag to give Intl: the device's own tag for this language when it has one (so en-GB keeps its dates, zh-HK its region) */
export function languageTag(lang: Lang = current): string {
  return deviceLocales().find((l) => supportedLanguage(l) === lang)?.languageTag ?? DEFAULT_TAG[lang];
}

/**
 * Props that mark one element as written in `lang` (a language's own name in a picker, say): the web page's `lang` attribute, so
 * the browser picks the right Han glyphs and a screen reader the right voice, and VoiceOver's accessibilityLanguage.
 */
export function inLanguage(lang: Lang): { accessibilityLanguage: string } {
  const props: Record<string, string> = { accessibilityLanguage: DEFAULT_TAG[lang] };
  if (Platform.OS === "web") props.lang = lang;
  return props as { accessibilityLanguage: string };
}

export function setLanguage(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  catalog = lang === "en" ? {} : loadCatalog(lang);
  if (Platform.OS === "web" && typeof document !== "undefined") document.documentElement.lang = lang === "en" ? "en" : lang;
  for (const listener of listeners) listener(lang);
}

export function onLanguageChange(listener: (lang: Lang) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

interface DeviceLocale {
  languageTag: string;
  languageCode?: string | null;
  languageScriptCode?: string | null;
  regionCode?: string | null;
}

function deviceLocales(): DeviceLocale[] {
  try {
    return getLocales();
  } catch {
    return [];
  }
}

/**
 * The first of the device's preferred languages that the app has, the way the phone itself chooses (English counts: someone who
 * prefers English and then Japanese gets English). Chinese goes by script, then by region: Taiwan, Hong Kong and Macau read
 * Traditional characters.
 */
export function languageOf(locales: DeviceLocale[], available: readonly Lang[] = READY): Lang {
  for (const l of locales) {
    const lang = supportedLanguage(l);
    if (lang && available.includes(lang)) return lang;
  }
  return "en";
}

/** which of the app's languages one device locale is, or null for a language the app doesn't have */
function supportedLanguage(l: DeviceLocale): Lang | null {
  const tag = l.languageTag.replace(/_/g, "-");
  const code = (l.languageCode ?? tag.split("-")[0] ?? "").toLowerCase();
  if (code === "en" || code === "ko" || code === "ja") return code;
  if (code !== "zh") return null;
  const script = l.languageScriptCode ?? (/-Hant(-|$)/i.test(tag) ? "Hant" : /-Hans(-|$)/i.test(tag) ? "Hans" : null);
  if (script) return script.toLowerCase() === "hant" ? "zh-Hant" : "zh-Hans";
  const region = (l.regionCode ?? tag.split("-")[1] ?? "").toUpperCase();
  return region === "TW" || region === "HK" || region === "MO" ? "zh-Hant" : "zh-Hans";
}

/** A saved choice of a language that is not (or no longer) ready falls back to the device's, then English. */
export function resolveLanguage(preference: LanguagePreference | undefined): Lang {
  return !preference || preference === "system" || !READY.includes(preference) ? languageOf(deviceLocales()) : preference;
}

/** "a, b and c" in the current language: 및 in Korean, the enumeration comma (、) in Chinese and Japanese */
export function listWords(items: string[]): string {
  if (items.length <= 1) return items.join("");
  const head = items.slice(0, -1);
  const last = items[items.length - 1];
  switch (current) {
    case "ko":
      return `${head.join(", ")} 및 ${last}`;
    case "ja":
      return [...head, last].join("、");
    case "zh-Hans":
    case "zh-Hant":
      return `${head.join("、")}和${last}`;
    default:
      return `${head.join(", ")} and ${last}`;
  }
}

/** a sentence's first letter capitalized (a no-op in scripts without case) */
export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * A length budget written in English characters, for the current language: Chinese and Japanese say about as much in half as
 * many characters, Korean in a little more than half. For teasers cut to fit a tile.
 */
export function charBudget(englishChars: number): number {
  const ratio = current === "en" ? 1 : current === "ko" ? 0.6 : 0.5;
  return Math.round(englishChars * ratio);
}

const noon = (isoDate: string) => new Date(`${isoDate}T12:00:00Z`);
const EN_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EN_NARROW = ["S", "M", "T", "W", "T", "F", "S"];

/** a calendar date's weekday ("Mon", "월", "周一", "週一", "月"), the same in every time zone */
export function weekdayShort(isoDate: string): string {
  if (current === "en") return EN_SHORT[noon(isoDate).getUTCDay()];
  try {
    return new Intl.DateTimeFormat(languageTag(), { weekday: "short", timeZone: "UTC" }).format(noon(isoDate));
  } catch {
    return EN_SHORT[noon(isoDate).getUTCDay()];
  }
}

/** a calendar date's weekday in one character, for chart axes */
export function weekdayNarrow(isoDate: string): string {
  if (current === "en") return EN_NARROW[noon(isoDate).getUTCDay()];
  try {
    return new Intl.DateTimeFormat(languageTag(), { weekday: "narrow", timeZone: "UTC" }).format(noon(isoDate));
  } catch {
    return EN_NARROW[noon(isoDate).getUTCDay()];
  }
}

/** "Oct 3" / "10월 3일" / "10月3日" for a moment in time, in the device's time zone */
export function monthDay(d: Date): string {
  try {
    return d.toLocaleDateString(languageTag(), { month: "short", day: "numeric" });
  } catch {
    return d.toDateString();
  }
}

/** a full date for a moment in time, in the device's time zone */
export function longDate(d: Date): string {
  try {
    return d.toLocaleDateString(languageTag(), { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return d.toDateString();
  }
}
