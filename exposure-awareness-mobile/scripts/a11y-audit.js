/*
 * A quick accessibility read of whatever screen is showing in the web build. Paste it into the browser console (or run it through a
 * browser tool), then call `__audit()`; it returns counts and the offending elements' text so they can be found and fixed.
 *
 * It is a spot check for the things a screen reader and a low-vision user hit first -- not a replacement for testing with real
 * assistive technology on a device. What it covers:
 *   - headings (there should be one h1 and no skipped levels) and the document language / title
 *   - interactive things with no accessible name, and form fields with no label
 *   - touch/click targets smaller than 24x24 CSS px (WCAG 2.5.8 minimum)
 *   - text contrast below 4.5:1 (3:1 for large text), measured against the nearest opaque background
 *   - text smaller than 11px
 *   - state exposed to assistive technology on radios, checkboxes, tabs and toggles
 *   - live regions (alerts, polite updates) and horizontal overflow
 */
(function () {
  const INTERACTIVE = 'button,[role=button],[role=tab],[role=radio],[role=checkbox],[role=switch],[role=link],a[href],input,textarea,select';

  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(',').map((x) => parseFloat(x));
    return { r, g, b, a };
  };
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const backgroundOf = (el) => {
    const chain = [];
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0) chain.push(c);
      if (c && c.a >= 0.99) break;
    }
    let bg = { r: 247, g: 245, b: 240, a: 1 }; // the app's page colour, if nothing opaque is found
    for (let i = chain.length - 1; i >= 0; i--) bg = over(chain[i], bg);
    return bg;
  };
  const visible = (el) => {
    if (el.closest('[aria-hidden=true]')) return false; // decorative: not part of what assistive technology reads
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  };
  const nameOf = (el) => {
    const labelled = el.getAttribute('aria-labelledby');
    if (labelled) {
      const t = labelled.split(/\s+/).map((id) => (document.getElementById(id) || {}).textContent || '').join(' ').trim();
      if (t) return t;
    }
    return (el.getAttribute('aria-label') || el.getAttribute('title') || (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? el.getAttribute('placeholder') : '') || el.textContent || '').trim();
  };
  const brief = (el) => ((el.getAttribute('aria-label') || el.textContent || el.tagName) + '').trim().replace(/\s+/g, ' ').slice(0, 60);

  window.__audit = function () {
    const out = {};

    // headings
    const heads = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading]')].filter(visible);
    const levels = heads.map((h) => (/^H[1-6]$/.test(h.tagName) ? +h.tagName[1] : +(h.getAttribute('aria-level') || 2)));
    let skips = 0;
    for (let i = 1; i < levels.length; i++) if (levels[i] > levels[i - 1] + 1) skips++;
    out.headings = { count: heads.length, h1: levels.filter((l) => l === 1).length, skippedLevels: skips, list: heads.slice(0, 12).map((h, i) => `h${levels[i]} ${brief(h)}`) };
    out.document = { lang: document.documentElement.lang || '(none)', title: document.title || '(none)' };

    // names
    const controls = [...document.querySelectorAll(INTERACTIVE)].filter(visible);
    out.interactive = controls.length;
    out.unnamed = controls.filter((el) => !nameOf(el)).map(brief);
    // the same name on several buttons ("Remove", "Bring back") leaves a screen-reader user guessing which one they are on
    const counts = {};
    controls.filter((el) => el.tagName !== 'INPUT' && el.getAttribute('role') !== 'radio' && el.getAttribute('role') !== 'tab').forEach((el) => {
      const n = nameOf(el).replace(/\s+/g, ' ');
      if (n && n.length <= 24) counts[n] = (counts[n] || 0) + 1;
    });
    out.repeatedNames = Object.entries(counts).filter(([, n]) => n > 1).map(([name, n]) => `${name} x${n}`);

    // targets
    out.smallTargets = controls
      .map((el) => [el, el.getBoundingClientRect()])
      .filter(([, r]) => r.width < 24 || r.height < 24)
      .map(([el, r]) => `${brief(el)} (${Math.round(r.width)}x${Math.round(r.height)})`);

    // contrast and size
    const low = [];
    const tiny = [];
    const seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent.trim();
      const el = n.parentElement;
      if (!text || !el || seen.has(el) || !visible(el)) continue;
      seen.add(el);
      const s = getComputedStyle(el);
      const size = parseFloat(s.fontSize);
      const bold = parseInt(s.fontWeight, 10) >= 700;
      const large = size >= 24 || (bold && size >= 18.66);
      const fg = parse(s.color);
      if (!fg) continue;
      const bg = backgroundOf(el);
      const c = ratio(fg.a < 1 ? over(fg, bg) : fg, bg);
      if (c < (large ? 3 : 4.5)) low.push(`${c.toFixed(2)}:1 ${text.slice(0, 40)}`);
      if (size < 11) tiny.push(`${size}px ${text.slice(0, 40)}`);
    }
    out.lowContrast = low;
    out.tinyText = tiny;

    // state on the things that have one
    const stateful = [...document.querySelectorAll('[role=radio],[role=checkbox],[role=switch]')].filter(visible);
    out.missingChecked = stateful.filter((el) => el.getAttribute('aria-checked') === null).map(brief);
    const tabs = [...document.querySelectorAll('[role=tab]')].filter(visible);
    out.missingSelected = tabs.filter((el) => el.getAttribute('aria-selected') === null).map(brief);

    // live regions and overflow
    out.liveRegions = [...document.querySelectorAll('[role=alert],[aria-live]')].length;
    out.horizontalOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    out.summary = `${heads.length} headings (${levels.filter((l) => l === 1).length} h1, ${skips} skipped), ${out.unnamed.length}/${controls.length} unnamed, ${out.repeatedNames.length} repeated names, ${out.smallTargets.length} small targets, ${low.length} low contrast, ${tiny.length} tiny text, ${out.missingChecked.length + out.missingSelected.length} missing state, overflow ${out.horizontalOverflow}`;
    return out;
  };
})();
