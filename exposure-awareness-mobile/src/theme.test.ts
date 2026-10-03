/**
 * Light and dark themes: the same tokens in both, every text colour readable (WCAG AA, 4.5:1) on every surface it sits on, and
 * no screen painting a colour the theme cannot switch.
 */
import * as fs from "fs";
import * as path from "path";
import { PALETTES, type Palette } from "./theme";

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** each text colour and the surfaces the app actually puts it on */
const PAIRS: [keyof Palette, (keyof Palette)[]][] = [
  ["ink", ["bg", "card", "surface", "panel", "segment", "accentSoft", "warnSoft", "noticeSoft", "calmBg", "calmCard", "highlight"]],
  ["muted", ["bg", "card", "surface", "panel", "segment", "accentSoft", "calmBg", "calmCard", "track"]],
  ["accent", ["bg", "card", "surface", "panel", "accentSoft", "segment", "calmBg", "calmCard"]],
  ["warn", ["bg", "card", "warnSoft", "surface"]],
  ["notice", ["bg", "card", "noticeSoft", "surface"]],
  ["onAccent", ["accentFill"]],
  ["onAccentMuted", ["accentFill"]],
  ["accentFill", ["onAccent"]],
  ["onInverse", ["inverseBg"]],
  ["onInverseMuted", ["inverseBg"]],
  ["onInverseAccent", ["inverseBg"]],
  ["vizBlue", ["card"]],
];

test("both themes define exactly the same tokens", () => {
  expect(Object.keys(PALETTES.dark).sort()).toEqual(Object.keys(PALETTES.light).sort());
});

for (const name of ["light", "dark"] as const) {
  test(`${name}: every text colour reaches 4.5:1 on every surface it sits on`, () => {
    const p = PALETTES[name];
    const below: string[] = [];
    for (const [fg, bgs] of PAIRS) for (const bg of bgs) if (contrast(p[fg], p[bg]) < 4.5) below.push(`${fg} on ${bg}: ${contrast(p[fg], p[bg]).toFixed(2)}`);
    expect(below).toEqual([]);
  });
}

test("the web page opens on the theme's own background in both modes, before the app has loaded", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  expect(html).toContain(`background-color: ${PALETTES.light.bg};`);
  expect(html).toMatch(new RegExp(`prefers-color-scheme: dark[^}]*\\{[^}]*\\{[^}]*background-color: ${PALETTES.dark.bg};`));
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "public", "manifest.json"), "utf8"));
  expect(manifest.background_color).toBe(PALETTES.light.bg);
  for (const icon of manifest.icons) expect(fs.existsSync(path.join(__dirname, "..", "public", icon.src))).toBe(true);
  // relative on purpose: the site lives under /<repo>/ on GitHub Pages
  expect(html).toContain('href="manifest.json"');
  expect(manifest.start_url).toBe(".");
});

test("screens and components take their colours from the theme, not from hex values the theme cannot switch", () => {
  const root = path.join(__dirname);
  // the plant's own illustration (pot, leaves, fruit) and the camera's black viewfinder are images, the same in either theme
  const allowed = new Set(["components/PlantView.tsx", "screens/ScanScreen.tsx"]);
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".tsx") && !e.name.endsWith(".test.tsx")) files.push(full);
    }
  };
  walk(path.join(root, "screens"));
  walk(path.join(root, "components"));
  const offenders = files
    .filter((f) => !allowed.has(path.relative(root, f)))
    .filter((f) => /"#[0-9a-fA-F]{3,8}"|"rgba?\(/.test(fs.readFileSync(f, "utf8")))
    .map((f) => path.relative(root, f));
  expect(offenders).toEqual([]);
});
