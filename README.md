# Exposure Awareness

[![CI](https://github.com/jasonjessewang/tox-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/jasonjessewang/tox-tool/actions/workflows/ci.yml)
[![Deploy web app](https://github.com/jasonjessewang/tox-tool/actions/workflows/pages.yml/badge.svg)](https://github.com/jasonjessewang/tox-tool/actions/workflows/pages.yml)
&middot; **[Try it](https://jasonjessewang.github.io/tox-tool/)** (live)

A private, on-device way to see what you're exposed to (food, personal care, air, the places you spend your days), compare it with published guidance, and make your own changes. Built on toxicology and exposure science; non-fear-based by design.

This folder is a working copy of everything: the app, the optional backend, the data pipeline, and the outputs from the latest full pass. Open it in Claude to keep working; nothing here depends on anything outside the folder.

## Start here

| I want to... | Do this |
|---|---|
| **See the app now**, no setup | Double-click `serve-compiled-web.command` (opens the compiled build in your browser). Or `cd outputs/web-app && python3 -m http.server 8090`, then open http://localhost:8090 |
| **Run the app in development** | Double-click `run-web.command`, or `cd exposure-awareness-mobile && npm run web` |
| **Read what was found, fixed and left open** | `exposure-awareness-mobile/docs/walkthrough-2026-09-26.md`, then `exposure-awareness-mobile/docs/qa-2026-10-02.md` |
| **See the numbers behind it** | `outputs/verification-2026-09-26.txt`, `outputs/walkthrough-tables.md`, `outputs/a11y-walk-2026-09-26.txt` |
| **Understand the app's design** | `exposure-awareness-mobile/README.md` |

## What's in the folder

```
TOX TOOL/
  exposure-awareness-mobile/     the app: Expo SDK 57, React Native 0.86, React 19, TypeScript, Jest
    src/engine/                  scoring, the wellness score's signals, places, recall, the ingredient engine
    src/data/                    hazard database (41 substances), lessons, recall questions, place checks, evidence (27)
    src/screens/, src/components/
    src/sim/                     four simulated lives used to test the engine over twelve weeks
    scripts/                     sim runner and report, walkthrough tables, browser accessibility audit + walk, timezone matrix
    docs/walkthrough-2026-09-26.md, docs/shipping.md, docs/qa-2026-10-02.md
    .sim-out/                    the last simulation run: results per person, and each person's storage as a snapshot
    eas.json, public/            iOS/Android build profiles; privacy.html + robots.txt served alongside the web app
  exposure-awareness-backend/    optional Node + SQLite backend (evidence API, label OCR, integrations); off by default
  tox-exposure-tool/             the Python prototype, and the data pipeline: hazard database, PubMed/PubChem sync, editorial scripts
  outputs/
    web-app/                     the compiled web build (static files; needs any static file server)
    verification-2026-09-26.txt  every check, as run on the final build
    walkthrough-tables.md        twelve weeks of use, four simulated people
    a11y-walk-2026-09-26.txt     the accessibility spot check across every screen
    experiments/                 earlier simulation runs and sweeps, with their scripts
  .github/workflows/             CI (types, tests, the sim, the backend, the data pipeline) and the GitHub Pages deploy
  CLAUDE.md                      how Claude should work in this folder
  setup.sh                       reinstall dependencies from the lockfiles
  run-web.command, serve-compiled-web.command   double-click launchers (they find Node for you; .node-env.sh is their helper)
```

`node_modules/` is already installed in the mobile app and the backend. If the folder is ever copied somewhere else, run `./setup.sh`.

## Commands

In `exposure-awareness-mobile`:

| | |
|---|---|
| `npm test` | 572 tests in 51 suites |
| `npm run typecheck` | TypeScript, strict |
| `npm run tz` | the whole suite under seven timezones (the day boundary was once a real bug) |
| `npm run sim` | four simulated people for 84 days each, then 79 checks on what the engine did |
| `npm run tables` | the "continued use" tables from the last simulation |
| `npm run web` | the app in a browser (development) |
| `npm run web:build` | a static build into `dist/` |
| `npm run snapshots` | serves a simulated person's storage and the audit scripts to the browser (see `scripts/snapshot-server.py`) |

Backend: `cd exposure-awareness-backend && npm test` (31 tests). Python: `cd tox-exposure-tool && python3 -m pytest -q tests` (33 tests).

Needs Node 22.5 or newer (the backend uses `node:sqlite`; this was built on Node 24), npm, and Python 3 with pytest.

## Where things stand (2026-09-26)

- Everything above passed on the 2026-09-26 build, again on the 2026-09-28 calm-mode/big-stones launch build, and again in the 2026-10-02 QA/QC pass (security, engine stability, accessibility, usability, calibration, stickiness -- three real bugs found and fixed, see `qa-2026-10-02.md`): 572 app tests, TypeScript clean, 79 of 79 checks on the simulated lives with the big-stones content live, and the Python data checks (database parity, plain summaries, scoring). The full timezone matrix, and the backend/Python suites, run in CI on every push.
- **Web only.** The app was built and verified as a web build at phone width. It has not been run on a phone or in a simulator: no camera scan, no push notification, no VoiceOver or TalkBack. Those are the most useful next things to test, and the walkthrough lists them.
- **Local-first.** A fresh install makes no network requests. What can leave the device, and when, is listed under About you > What leaves this device, and in section 5 of the walkthrough.

## Publishing (Git, the live site, iOS and Android)

Live at [jasonjessewang.github.io/tox-tool](https://jasonjessewang.github.io/tox-tool/), pushed from this folder's
`main` branch (MIT-licensed). CI runs on every push and pull request (`.github/workflows/ci.yml`: types, the 572
tests, the timezone matrix, the engine simulation, the backend, and the data pipeline); `.github/workflows/pages.yml`
builds and deploys the web app itself on every push to `main`, no further steps needed after the one-time setup below.

Reusing this folder under a different GitHub repo needs that same one-time setup again:

```bash
# once, on GitHub: create an empty repository (no README/license/gitignore — this folder already has them)
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

then **Settings &rsaquo; Pages &rsaquo; Build and deployment &rsaquo; Source: GitHub Actions** (one toggle, one
time), and a find-and-replace of `jasonjessewang/tox-tool` in the badges and the "Try it" link above for your own
repo name.

iOS and Android build in the cloud through EAS once you've logged in with your own free Expo account; the exact
commands and what each app store's listing will ask for are in
[exposure-awareness-mobile/docs/shipping.md](exposure-awareness-mobile/docs/shipping.md).
