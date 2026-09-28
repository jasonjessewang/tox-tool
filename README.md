# Exposure Awareness

A private, on-device way to see what you're exposed to (food, personal care, air, the places you spend your days), compare it with published guidance, and make your own changes. Built on toxicology and exposure science; non-fear-based by design.

This folder is a working copy of everything: the app, the optional backend, the data pipeline, and the outputs from the latest full pass. Open it in Claude to keep working; nothing here depends on anything outside the folder.

## Start here

| I want to... | Do this |
|---|---|
| **See the app now**, no setup | Double-click `serve-compiled-web.command` (opens the compiled build in your browser). Or `cd outputs/web-app && python3 -m http.server 8090`, then open http://localhost:8090 |
| **Run the app in development** | Double-click `run-web.command`, or `cd exposure-awareness-mobile && npm run web` |
| **Read what was found, fixed and left open** | `exposure-awareness-mobile/docs/walkthrough-2026-09-26.md` |
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
    docs/walkthrough-2026-09-26.md
    .sim-out/                    the last simulation run: results per person, and each person's storage as a snapshot
  exposure-awareness-backend/    optional Node + SQLite backend (evidence API, label OCR, integrations); off by default
  tox-exposure-tool/             the Python prototype, and the data pipeline: hazard database, PubMed/PubChem sync, editorial scripts
  outputs/
    web-app/                     the compiled web build (static files; needs any static file server)
    verification-2026-09-26.txt  every check, as run on the final build
    walkthrough-tables.md        twelve weeks of use, four simulated people
    a11y-walk-2026-09-26.txt     the accessibility spot check across every screen
    experiments/                 earlier simulation runs and sweeps, with their scripts
  CLAUDE.md                      how Claude should work in this folder
  setup.sh                       reinstall dependencies from the lockfiles
  run-web.command, serve-compiled-web.command   double-click launchers (they find Node for you; .node-env.sh is their helper)
```

`node_modules/` is already installed in the mobile app and the backend. If the folder is ever copied somewhere else, run `./setup.sh`.

## Commands

In `exposure-awareness-mobile`:

| | |
|---|---|
| `npm test` | 567 tests in 50 suites |
| `npm run typecheck` | TypeScript, strict |
| `npm run tz` | the whole suite under seven timezones (the day boundary was once a real bug) |
| `npm run sim` | four simulated people for 84 days each, then 79 checks on what the engine did |
| `npm run tables` | the "continued use" tables from the last simulation |
| `npm run web` | the app in a browser (development) |
| `npm run web:build` | a static build into `dist/` |
| `npm run snapshots` | serves a simulated person's storage and the audit scripts to the browser (see `scripts/snapshot-server.py`) |

Backend: `cd exposure-awareness-backend && npm test` (28 tests). Python: `cd tox-exposure-tool && python3 -m pytest -q tests` (33 tests).

Needs Node 22.5 or newer (the backend uses `node:sqlite`; this was built on Node 24), npm, and Python 3 with pytest.

## Where things stand (2026-09-26)

- Everything above passed on the 2026-09-26 build. On the calm-mode and big-stones branch (2026-09-28): 567 app tests, TypeScript clean, 79 of 79 checks on the simulated lives, the suite under Pacific/Kiritimati, and the Python data checks (database parity, plain summaries, scoring); the full timezone matrix and the backend/Python suites run in CI once the repo is on GitHub.
- **Web only.** The app was built and verified as a web build at phone width. It has not been run on a phone or in a simulator: no camera scan, no push notification, no VoiceOver or TalkBack. Those are the most useful next things to test, and the walkthrough lists them.
- **No version control here.** Nothing is committed anywhere. `git init` at this level (or per project) is one command away if you want history.
- **Local-first.** A fresh install makes no network requests. What can leave the device, and when, is listed under About you > What leaves this device, and in section 5 of the walkthrough.
