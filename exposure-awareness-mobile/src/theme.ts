// Started from the palette in tox-exposure-tool/static/style.css, so the web and mobile apps read
// as one product. `card` is a warm off-white (not pure #fff) so surfaces sit gently on the
// cream background instead of punching through it -- part of the softer, calmer visual
// language the app moved to (see theme.radius/shadow below).
//
// Two colors were deepened for legibility, checked against WCAG AA (4.5:1 for normal text) on every surface they sit on:
// `warn` was #b9862f (2.8-3.2:1 -- it failed for any text under 24px, which is nearly everywhere it is used) and `muted` was
// #6b6b6b (4.4:1 on the segmented-control track). And there is no red: "higher" and "worth swapping" are things to act on when
// convenient, not alarms, so they take a deeper amber (`notice`), matching the wording.
export const colors = {
  bg: "#f7f5f0",
  card: "#fffdf9",
  ink: "#232323",
  muted: "#5f5f5f",
  line: "#e6e0d3",
  accent: "#3f6b52",
  accentSoft: "#e7efe9",
  warn: "#8a6316",
  warnSoft: "#f7ecd9",
  notice: "#6b4712",
  noticeSoft: "#f0dfc0",
};

export const bandColor: Record<string, string> = {
  minimal: colors.accent,
  low: colors.accent,
  moderate: colors.warn,
  priority: colors.notice,
};

export const concernPill: Record<number, { bg: string; fg: string; label: string }> = {
  1: { bg: colors.accentSoft, fg: colors.accent, label: "low" },
  2: { bg: colors.warnSoft, fg: colors.warn, label: "moderate" },
  3: { bg: colors.noticeSoft, fg: colors.notice, label: "higher" },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

// Soft-edges design language: one radius scale used everywhere instead of each screen
// picking its own number, and one shadow recipe (a gentle lift, not a hard drop shadow)
// that reads the same on iOS (shadow*) and Android (elevation).
export const radius = 16;
export const radiusSm = 12;
export const radiusLg = 22;
export const radiusPill = 999;

export const shadow = {
  shadowColor: "#2b2417",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 10,
  elevation: 2,
} as const;

export const shadowRaised = {
  shadowColor: "#2b2417",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.1,
  shadowRadius: 18,
  elevation: 4,
} as const;
