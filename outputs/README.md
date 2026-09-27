# Outputs

Generated from the code in this folder, on the final build of 2026-09-26. Regenerate rather than edit.

| File or folder | What it is | How to regenerate |
|---|---|---|
| `web-app/` | the compiled web build: static files | `cd exposure-awareness-mobile && npm run web:build` (writes `dist/`), then copy; or open with `serve-compiled-web.command` at the top of this folder |
| `verification-2026-09-26.txt` | every check on the final build: types, 552 tests, seven timezones, 79 simulation checks, backend, Python | the commands are shown in the file |
| `jest-verbose-2026-09-26.txt` | the full list of the 552 tests | `npx jest --verbose` |
| `sim-report-2026-09-26.txt` | what the engine did for each of the four simulated people, and the 79 checks | `npm run sim` |
| `walkthrough-tables.md` | twelve weeks of use, four simulated people | `npm run tables` |
| `a11y-walk-2026-09-26.txt` | the accessibility spot check across every screen, at 375 px and 320 px | `scripts/a11y-walk.js` (see `scripts/snapshot-server.py`) |
| `experiments/` | earlier simulation runs and sweeps, with their scripts | see its README |

The walkthrough that reads these results is `exposure-awareness-mobile/docs/walkthrough-2026-09-26.md`.
