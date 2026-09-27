/*
 * Walks every screen of the web build and runs the accessibility spot check (scripts/a11y-audit.js) on each one.
 *
 * Paste a11y-audit.js into the browser console first, then this file, then `await __walk()`. It needs a profile with some history
 * (load a snapshot from `npm run sim`, e.g. .sim-out/priya.snapshot.json) and "Straight there" chosen under About you, so that
 * moving between screens does not stop on the learning-moment screen. Screens it cannot reach are reported as "not reached"
 * rather than skipped silently. Returns one line per screen.
 */
(function () {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ROLES = '[role=button],[role=tab],[role=radio],[role=checkbox],a[href]';
  const find = (text, roles = ROLES) => [...document.querySelectorAll(roles)].find((e) => (e.getAttribute('aria-label') || e.textContent).trim().includes(text));
  const click = (text, roles) => {
    const el = find(text, roles);
    if (el) el.click();
    return !!el;
  };
  const settle = async () => {
    await sleep(350);
    for (let i = 0; i < 5 && click('Skip'); i++) await sleep(700);
    await sleep(700);
  };
  const back = async () => {
    const el = document.querySelector('[aria-label^="Back to"]') || [...document.querySelectorAll('[role=button]')].find((e) => /^‹/.test(e.textContent.trim()));
    if (el) el.click();
    await settle();
    return !!el;
  };
  const line = (a) =>
    `${a.headings.count} headings (${a.headings.h1} h1, ${a.headings.skippedLevels} skipped) · ${a.unnamed.length}/${a.interactive} unnamed · ${a.repeatedNames.length} repeated · ${a.smallTargets.length} small targets · ${a.lowContrast.length} low contrast · ${a.tinyText.length} tiny · ${a.missingChecked.length + a.missingSelected.length} missing state` +
    (a.horizontalOverflow ? ' · OVERFLOW' : '') +
    [a.unnamed.length && `\n    unnamed: ${a.unnamed.slice(0, 3).join('; ')}`, a.repeatedNames.length && `\n    repeated: ${a.repeatedNames.slice(0, 3).join('; ')}`, a.smallTargets.length && `\n    small: ${a.smallTargets.slice(0, 3).join('; ')}`, a.lowContrast.length && `\n    contrast: ${a.lowContrast.slice(0, 3).join('; ')}`, a.tinyText.length && `\n    tiny: ${a.tinyText.slice(0, 3).join('; ')}`].filter(Boolean).join('');

  window.__walk = async function () {
    const rows = [];
    const rec = (name) => rows.push(`${name}: ${line(window.__audit())}`);
    const step = async (name, fn) => {
      try {
        const ok = await fn();
        if (ok === false) rows.push(`${name}: not reached`);
      } catch (e) {
        rows.push(`${name}: not reached (${e.message})`);
      }
    };
    const tab = async (t) => (click(t, '[role=tab]') ? (await settle(), true) : false);
    const open = async (t) => (click(t, '[role=button]') ? (await settle(), true) : false);

    await step('Dashboard', async () => (await tab('Dashboard')) && (rec('Dashboard'), true));
    await step('Score', async () => {
      if (!(await open('/ 100'))) return false;
      rec('Score');
      await back();
    });
    await step('Journey hub', async () => {
      if (!(await open('YOUR NEXT STEP'))) return false;
      rec('Journey hub');
    });
    for (const tile of ['Scan', 'Food', 'Sleep', 'Air', 'Biomarkers', 'Shelf', 'About you']) {
      await step(tile, async () => {
        if (!(await open(tile))) return false;
        rec(tile);
        await back();
      });
    }
    await step('Places', async () => {
      if (!(await open('Places'))) return false;
      rec('Places');
      const card = [...document.querySelectorAll('[role=button]')].find((e) => /answered/.test(e.textContent) && !/^‹/.test(e.textContent.trim()));
      if (card) {
        card.click();
        await settle();
        rec('Place detail');
        const check = [...document.querySelectorAll('[role=button]')].find((e) => /Worth a look|Meets|Not answered/.test(e.textContent));
        if (check) {
          check.click();
          await sleep(700);
          rec('Place check open');
        }
        // the way out of a place is its own "‹ Your places", not the header's back (which would leave Places altogether)
        click('Your places', '[role=button]');
        await settle();
      }
      await back();
    });
    await step('Roadmap', async () => {
      if (!(await open('See the whole roadmap'))) return false;
      rec('Roadmap');
      await back();
    });
    await step('Connected sources', async () => {
      if (!(await open('Connected sources'))) return false;
      rec('Connected sources');
      await back();
    });
    await step('Tutorial quests', async () => {
      if (!(await open('Show me'))) return false;
      rec('Tutorial quests');
      await back();
    });
    await step('Research (from the hub)', async () => {
      if (!(await open('Open Research'))) return false;
      rec('Research (from the hub)');
      await back();
    });
    await back();

    for (let i = 1; i <= 4; i++) {
      await step(`Daily, step ${i}`, async () => {
        if (i === 1 && !(await tab('Daily'))) return false;
        if (i > 1 && !(await open('Next'))) return false;
        await sleep(500);
        rec(`Daily, step ${i}`);
      });
    }
    await step('Weekly', async () => (await tab('Weekly')) && (rec('Weekly'), true));

    await step('Learn: Topics', async () => {
      if (!(await tab('Learn'))) return false;
      click('Topics', '[role=tab]');
      await sleep(600);
      rec('Learn: Topics');
      if (click('Food', '[role=button]')) {
        await sleep(700);
        rec('Learn: a theme');
        const first = [...document.querySelectorAll('[role=button]')].find((e) => !/^‹|Learn|Dashboard|Daily|Weekly/.test(e.textContent.trim()));
        if (first) {
          first.click();
          await sleep(800);
          rec('Learn: a substance page');
          await back();
        }
        await back();
      }
    });
    await step('Learn: Research', async () => {
      click('Research', '[role=tab]');
      await sleep(800);
      rec('Learn: Research');
      const card = find('citations', '[role=button]');
      if (card) {
        card.click();
        await sleep(800);
        rec('Learn: a research page');
        await back();
      }
    });
    await step('Learn: Engine', async () => {
      click('Engine', '[role=tab]');
      await sleep(900);
      rec('Learn: Engine');
      for (const tool of ['Risk translator', 'Dose-response explorer', 'Safety-threshold builder', 'Evidence ladder', 'Confounding lab', 'See your engine run']) {
        if (click(tool, '[role=button]')) {
          await sleep(900);
          rec(`Engine: ${tool}`);
          await back();
        }
      }
      if (click('Review now', '[role=button]') || click('Try them', '[role=button]')) {
        await sleep(800);
        rec('Engine: a quick review');
        const radio = document.querySelector('[role=radio]');
        if (radio) {
          radio.click();
          await sleep(500);
          rec('Engine: a quick review, answered');
        }
        await back();
      }
      const lesson = find('Start', '[role=button]');
      if (lesson) {
        lesson.click();
        await sleep(900);
        rec('Engine: a lesson');
        const tryIt = find('Try the questions', '[role=button]');
        if (tryIt) {
          tryIt.click();
          await sleep(600);
          rec('Engine: a lesson, questions open');
        }
        await back();
      }
    });
    await step('Learn: Concepts', async () => {
      click('Concepts', '[role=tab]');
      await sleep(900);
      rec('Learn: Concepts');
      const pillar = [...document.querySelectorAll('[role=button]')].find((e) => /lesson/.test(e.textContent) && !/^‹/.test(e.textContent.trim()));
      if (pillar) {
        pillar.click();
        await sleep(800);
        rec('Learn: an audio pillar');
        await back();
      }
    });
    return rows;
  };
})();
