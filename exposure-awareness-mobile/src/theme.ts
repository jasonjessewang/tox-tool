// Started from the palette in tox-exposure-tool/static/style.css, so the web and mobile apps read
// as one product. `card` is a warm off-white (not pure #fff) so surfaces sit gently on the
// cream background instead of punching through it -- part of the softer, calmer visual
// language the app moved to (see theme.radius/shadow below).
//
// Two colors were deepened for legibility, checked against WCAG AA (4.5:1 for normal text) on every surface they sit on:
// `warn` was #b9862f (2.8-3.2:1 -- it failed for any text under 24px, which is nearly everywhere it is used) and `muted` was
// #6b6b6b (4.4:1 on the segmented-control track). And there is no red: "higher" and "worth swapping" are things to act on when
// convenient, not alarms, so they take a deeper amber (`notice`), matching the wording.
//
// Dark mode (2026-10-02): every text colour was checked against every surface it sits on in both palettes (theme.test.ts holds
// it). One green cannot be both readable text on a dark card and a fill under white text, so `accent` is for text, lines and
// decoration and `accentFill` is for filled buttons, chips and cards that carry `onAccent` text.
import { Appearance, Platform } from "react-native";

const LIGHT = {
  bg: "#f7f5f0",
  card: "#fffdf9",
  /** inputs, chips and option rows inside a card */
  surface: "#ffffff",
  /** a quieter inset area inside a card */
  panel: "#f3efe4",
  /** the trough of a segmented control */
  segment: "#ece8dd",
  /** the empty part of a progress bar, and quiet chips */
  track: "#eee9dd",
  ink: "#232323",
  muted: "#5f5f5f",
  line: "#e6e0d3",
  accent: "#3f6b52",
  accentSoft: "#e7efe9",
  accentFill: "#3f6b52",
  onAccent: "#ffffff",
  onAccentMuted: "#e6f1ea",
  warn: "#8a6316",
  warnSoft: "#f7ecd9",
  notice: "#6b4712",
  noticeSoft: "#f0dfc0",
  /** a card set apart from the rest (the Engine Room door) */
  inverseBg: "#232323",
  onInverse: "#ffffff",
  onInverseMuted: "#d9d6cc",
  onInverseAccent: "#9ec4ac",
  /** the learning-moment screen and the plant's card */
  calmBg: "#f0f4ef",
  calmCard: "#f1f6ef",
  calmLine: "#dce8d8",
  calmBlobA: "#e2ebe1",
  calmBlobB: "#eaf0e6",
  orbLine: "#d6e2d4",
  calmTrack: "rgba(63,107,82,0.2)",
  /** a warm box that draws the eye to one worked example */
  highlight: "#fbf3e6",
  highlightLine: "#e3c9a4",
  /** charts in the Engine tools */
  vizNeutral: "#8b8b8b",
  vizMuted: "#d9d4c5",
  vizEmpty: "#e8e4d9",
  vizLow: "#c7c1b1",
  vizAmber: "#e07b00",
  vizOrange: "#d9822b",
  vizGreen: "#7fb08f",
  vizBlue: "#3b6fd1",
  /** the soft disc behind the plant */
  glowWarm: "#fbf1c9",
  glowA: "#f1eedc",
  glowB: "#ece8de",
};

export type Palette = typeof LIGHT;

const DARK: Palette = {
  bg: "#121411",
  card: "#1b1e1a",
  surface: "#232722",
  panel: "#20241f",
  segment: "#262a25",
  track: "#2c312a",
  ink: "#ebe9e3",
  muted: "#aaada4",
  line: "#30352e",
  accent: "#86c19c",
  accentSoft: "#1f2e25",
  accentFill: "#2f6646",
  onAccent: "#ffffff",
  onAccentMuted: "#d6e8dc",
  warn: "#e0bb6e",
  warnSoft: "#2e2717",
  notice: "#eca55e",
  noticeSoft: "#33261a",
  inverseBg: "#26332b",
  onInverse: "#ffffff",
  onInverseMuted: "#c9c6bc",
  onInverseAccent: "#9ec4ac",
  calmBg: "#141813",
  calmCard: "#1a2219",
  calmLine: "#2a3527",
  calmBlobA: "#1a2418",
  calmBlobB: "#18201a",
  orbLine: "#2f3d2c",
  calmTrack: "rgba(134,193,156,0.25)",
  highlight: "#2a2418",
  highlightLine: "#5c4a2a",
  vizNeutral: "#8f938b",
  vizMuted: "#454a42",
  vizEmpty: "#30352d",
  vizLow: "#5b6056",
  vizAmber: "#f0962a",
  vizOrange: "#e8964a",
  vizGreen: "#7fb08f",
  vizBlue: "#7ea6f0",
  glowWarm: "#3a351f",
  glowA: "#2e2c22",
  glowB: "#2a2924",
};

export const PALETTES = { light: LIGHT, dark: DARK } as const;

export type ThemeName = "light" | "dark";
export type ThemePreference = "system" | ThemeName;

const WEB = Platform.OS === "web";

const systemTheme = (): ThemeName => (Appearance.getColorScheme() === "dark" ? "dark" : "light");

/**
 * The colours every style sheet reads. On the web each one is a CSS variable, so a theme change repaints at once and "match my
 * device" follows the system live. On a phone it is the palette chosen when the app opens (src/Root.tsx picks it before any screen
 * loads), because style sheets there read their colours once.
 */
export const colors: Palette = WEB
  ? (Object.fromEntries(Object.keys(LIGHT).map((k) => [k, `var(--c-${k})`])) as Palette)
  : { ...(systemTheme() === "dark" ? DARK : LIGHT) };

if (WEB && typeof document !== "undefined" && !document.getElementById("app-theme")) {
  const vars = (p: Palette) => Object.entries(p).map(([k, v]) => `--c-${k}:${v};`).join("");
  const style = document.createElement("style");
  style.id = "app-theme";
  style.textContent =
    `:root{${vars(LIGHT)}color-scheme:light;}` +
    `:root[data-theme="dark"]{${vars(DARK)}color-scheme:dark;}` +
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${vars(DARK)}color-scheme:dark;}}` +
    `html,body{background:var(--c-bg);}`;
  document.head.appendChild(style);
}

export const bandColor: Record<string, string> = {};
export const concernPill: Record<number, { bg: string; fg: string; label: string }> = {};

function deriveMaps() {
  Object.assign(bandColor, { minimal: colors.accent, low: colors.accent, moderate: colors.warn, priority: colors.notice });
  Object.assign(concernPill, {
    1: { bg: colors.accentSoft, fg: colors.accent, label: "low" },
    2: { bg: colors.warnSoft, fg: colors.warn, label: "moderate" },
    3: { bg: colors.noticeSoft, fg: colors.notice, label: "higher" },
  });
}
deriveMaps();

let preference: ThemePreference = "system";

/** Which palette is showing for a preference: the device's own setting for "system". */
export function resolveTheme(pref: ThemePreference = preference): ThemeName {
  return pref === "system" ? systemTheme() : pref;
}

/**
 * Applies a preference. On the web this is live; on a phone, call it only before the screens load (src/Root.tsx) -- after that,
 * style sheets keep the colours they were created with, so a change shows the next time the app opens.
 */
export function applyTheme(pref: ThemePreference): ThemeName {
  preference = pref;
  if (WEB) {
    if (typeof document !== "undefined") {
      if (pref === "system") delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = pref;
    }
  } else {
    Object.assign(colors, resolveTheme(pref) === "dark" ? DARK : LIGHT);
    deriveMaps();
  }
  return resolveTheme(pref);
}

/** A palette colour as a literal hex value, for the few places a CSS variable cannot go (native APIs, colour math). */
export const rawColor = (token: keyof Palette): string => PALETTES[resolveTheme()][token];

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

// Soft-edges design language: one radius scale used everywhere instead of each screen
// picking its own number, and one shadow recipe (a gentle lift, not a hard drop shadow)
// that reads the same on iOS (shadow*) and Android (elevation). Shadow colours stay literal: on the web a CSS-variable
// shadow colour would lose its opacity and turn the soft lift into a hard outline.
export const radius = 16;
export const radiusSm = 12;
export const radiusLg = 22;
export const radiusPill = 999;

export const SHADOW_TINT = "#2b2417";
export const ACCENT_SHADOW = "#3f6b52";

export const shadow = {
  shadowColor: SHADOW_TINT,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 10,
  elevation: 2,
} as const;

export const shadowRaised = {
  shadowColor: SHADOW_TINT,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.1,
  shadowRadius: 18,
  elevation: 4,
} as const;
