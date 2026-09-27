# Exposure Awareness: how to work in this folder

This is the shared workspace for the exposure-awareness project. Read this first; it is short on purpose. The design story is in `exposure-awareness-mobile/README.md`, and the latest full pass (what was found, fixed and left open) is `exposure-awareness-mobile/docs/walkthrough-2026-09-26.md`.

## What is here

- `exposure-awareness-mobile/`: the app. Expo SDK 57, React Native 0.86, React 19, TypeScript (strict), Jest. Verified as a web build only. **Read the versioned Expo docs (https://docs.expo.dev/versions/v57.0.0/) before writing Expo code**: the API surface has changed (see its `AGENTS.md`).
- `exposure-awareness-backend/`: optional Node + `node:sqlite` backend (evidence API, label OCR, integrations). Off by default.
- `tox-exposure-tool/`: the Python prototype and the data pipeline. `data/hazard_database.json` is the source of the app's substance data; `sources/sync_db.py` refreshes references from PubMed and PubChem; `scripts/` holds the editorial passes (technical notes, plain-language summaries).
- `outputs/`: generated deliverables (compiled web build, verification log, tables, accessibility walk, earlier experiments). Regenerate rather than edit by hand.

Sibling folder names matter: tests and scripts refer to `../exposure-awareness-mobile` and `../tox-exposure-tool`.

## What the owner cares about (hard invariants)

The owner has an MS in Toxicology and Human Risk (Johns Hopkins). Treat them as a domain expert.

1. **Non-fear tone.** No risk / danger / toxic / unsafe / "bad" vocabulary in band labels, lessons, recall feedback, plain-language text or new wording; tests hold this with string assertions. "Removing bad *and* adding good", tracked separately.
2. **Measure, disclose, decentralize.** Every number answers "compared with what?", uncertainty is shown rather than hidden, and the person decides ("I'm keeping this" is a fine answer). Nothing is auto-applied.
3. **Local-first.** Entries, the shelf, places and learning stay on the device. New network calls need a stated reason, an entry in About you > What leaves this device, and an off switch.
4. **Never fabricate identifiers or citations.** PMIDs, DTXSIDs, CAS numbers and DOIs are resolved live (PubMed, PubChem), never typed from memory. When PubMed content is used in an answer, attribute it to PubMed and include the DOI links.
5. **Measuring is never punished.** Logging more, scanning a clean product, answering more that meets a reference, answering a recall question: none of these may lower a score. Back "never lowers" claims with randomized property tests, not only a simulation that happened to pass.
6. **Evidence is labelled for what it is.** A study of something nearby is "Wider context" (`context_substance_ids`), never "Research behind this".

## Standing instruction from the owner (their words)

"Continue to work autonomously until this session's token limit is close to being reached, I will test against it. This will be the new norm: lots of self-evaluative building, internal refinement against popular sticky apps, and autonomous approaches, leveraging as much real public health science (toxicology databases, PubMed, CompTOX, etc.) as the foundational core engine as possible."

In practice: work in long stretches, verify after every change (types, tests, and actually looking at the running app), benchmark against successful consumer health apps, and ground the engine in real public data. Ask before anything outward-facing (publishing, sending, committing or pushing) and before deleting anything.

## Commands

In `exposure-awareness-mobile`: `npm test` (552 tests), `npm run typecheck`, `npm run tz` (seven timezones), `npm run sim` (79 checks), `npm run tables`, `npm run web`, `npm run snapshots`, `npm run web:build`. Backend `npm test` (28). Python `python3 -m pytest -q tests` (33). `.claude/launch.json` defines `expo-web` (dev server, port 8081) and `compiled-web` (the static build, port 8090) for the preview tools. (A session that was *moved* into this folder from somewhere else keeps its original directory for `preview_start {name}`: check `preview_list` for the `cwd` it runs from, and if it is not this folder, start the server here with Bash and open it with `preview_start {url}`.)

After engine, scoring or advice changes: `npm run sim` and check all invariants pass. After anything date-related: `npm run tz`.

## Working rules learned the hard way

- **Edit, don't rewrite.** Use the Edit tool, or a script that asserts its match count. Look at generated assets (images, charts, screens) before trusting them.
- **Audit every screen, not a sample.** `scripts/a11y-audit.js` and `scripts/a11y-walk.js` (see `scripts/snapshot-server.py` for how to load them and a simulated person into the browser). Say what a spot check cannot show: screen-reader order, focus, live regions, dynamic type, native.
- **Two copies of the data must stay identical.** `tox-exposure-tool/data/hazard_database.json` and `exposure-awareness-mobile/src/data/hazardDatabase.json` (a Python test checks); `src/data/evidence.json` and `exposure-awareness-backend/seed/evidence.json`. Editorial fields (`summary`, `summary_plain`, tips, `concern_level`) are never touched by `sync_db.py`.
- **Adding an activity or a storage key** is enforced at compile time: classify it in `src/engine/signals/registry.ts` and wrap the write in `runActivity(kind, write)` so it returns a comparison receipt.
- **Measure heuristic changes on the simulated lives** before choosing between variants, and run sweeps from bash files (inline zsh loops have bitten before).
- **Jest** is capped at two workers in `package.json`: with one per core a worker segfaulted in about 1 full run in 12 (Node 24 + Jest 29). If it recurs, `npx jest --runInBand`.
- **Web caveat.** React Native Web maps `accessibilityRole`/`accessibilityLabel` but not `accessibilityState`: use `aria-checked`, `aria-selected`, `aria-expanded` alongside.

## Open items (from the walkthrough)

No real VoiceOver/TalkBack or device testing; native build, camera scan and push notifications not run; a top recommendation nobody answers stays #1 for weeks; recall questions are multiple-choice only; weak citations for SLS, formaldehyde releasers, siloxanes and talc; the learning moment between screens is on by default (about 40 s of forced waiting in a first session); the Python prototype has no score signals, places or recall.
