# Exposure Awareness — Mobile (Expo / React Native)

The mobile port of `tox-exposure-tool`. Same engine, same hazard data, same design
intent — ported to a real, offline-first mobile app shell rather than a mockup.

## What's actually verified here (not just written)

- **Engine parity**: `src/engine/scoring.ts`, `aqi.ts`, `produce.ts` are direct ports of
  the Python originals. `src/engine/scoring.test.ts` mirrors
  `tox-exposure-tool/tests/test_scoring.py` scenario-for-scenario, including the Quick
  Wins vs. Focus divergence test and the "acrylamide needs the exact phrase"
  matching-limits test.
- **Typecheck clean**: `npx tsc --noEmit` passes with zero errors across the whole app.
- **552 Jest tests pass** (`npm test`) across 49 suites: engine parity, journey/quest data
  integrity, the ingredient engine, literacy, evidence, dates, free-text matching, the
  standing-exposure model, trend labels, the wellness score's signals and receipts, the places
  lens (catalog integrity, dated answers, household weighting), the recall questions (scheduling,
  the Understanding part, storage), readings over time, plain-language summaries, undo, and randomized
  property tests (retiring a product can never lower the shelf part; answering one more thing that meets its
  reference can never lower the places part; practising recall can never lower Understanding). The suite is also run under seven timezones
  (`TZ=Pacific/Kiritimati npm test`, `TZ=America/Chicago npm test`, ...) because the day
  boundary was once a real bug: see the engine soak run below.
- **An engine soak run** (`npm run sim`): four simulated people use the real storage layer
  and the real engine for 12 weeks each, in their own timezones, acting on the engine's
  own advice and taking the recall questions, then the results are checked against 79 invariants. See below.
- **A walkthrough of every pathway** from a fresh install to twelve weeks of use, with content, privacy,
  accessibility and learning checked and the findings fixed or listed:
  [docs/walkthrough-2026-09-26.md](docs/walkthrough-2026-09-26.md). Its numbers come from `npm run sim`
  (`npm run tables`) and from `scripts/a11y-audit.js` / `scripts/a11y-walk.js`, which run in the browser
  (`npm run snapshots` serves them, and a simulated person's storage, to it).
- **Actually runs**: verified live via `npx expo start --web` multiple times across this
  build, driven through real taps — logging entries, watching the dashboard fuse them,
  achievement unlocks firing, checking off starter-journey quests and watching the XP bar
  and "Next up" advance live, daily quests auto-completing from real logged behavior (not
  just manual taps), and the weekly trend bar chart rendering real historical data (zero
  for empty past weeks, a real value for the current week) computed from actual
  `scoreLogs()` runs over rolling 7-day windows — not mocked or hardcoded.
- **Notification triggers verified end to end**, with one honest caveat: the embedded
  browser pane this was tested in has `Notification.permission` pre-set to `"denied"` at
  the environment level (a sandbox constraint, confirmed via direct JS inspection — no OS
  toast can render here). Rather than fake it, `notify.fireLocal()` falls back to a
  console log when permission is missing, and both trigger paths were verified firing with
  the exact right content at the exact right moment via that log: an achievement unlock
  (`🌱 First Step unlocked -- Logged your first entry.`) and an AQI event (`Unhealthy for
  Sensitive Groups air quality -- 45 µg/m³ PM2.5 in Home. ...`, using the live EPA
  guidance text). **Open the app in your own regular browser** (not an embedded/automated
  one) to see the real permission prompt and real OS notification toast.
- **Bundled data confirmed small**: the 4 JSON data files total ~124KB, confirming the
  "downloadable, works offline" design goal from the original ask.

## What's built vs. what's next

| Piece | Status |
|---|---|
| Engine: scoring, AQI, produce, achievements, quests, trends, the ingredient engine, places, the score's signals, recall | **Built and tested** (552 tests; 79 checks on the simulated lives) |
| Local storage (AsyncStorage): every entry, the shelf, places, learning events, settings | **Working**; a copy can be exported and everything deleted under About you |
| Screens: Dashboard, Daily (four steps), Weekly, Learn (Topics, Research, Engine, Concepts), Journey (hub, tutorial quests, roadmap), Score, Scan + product review + Shelf, Food, Sleep, Air, Biomarkers, Places, About you, Connected sources | **Working**, driven live in the browser at phone width; every one audited for accessibility ([walkthrough](docs/walkthrough-2026-09-26.md)) |
| Barcode look-up (typed number), pasted label text | **Verified**. Camera scanning is implemented with `expo-camera` but needs a device camera to exercise; reading a label from a photo needs a backend the person runs |
| Local notifications | **Web verified** (the embedded browser blocks the OS prompt, so both triggers were verified through the logged fallback). The native path (`expo-notifications`, scheduled daily check-in) is implemented against the SDK 57 docs and **not exercised on a device** here |
| Native iOS/Android build (Simulator or device) | **Not built or run here** -- no Xcode/Android Studio in this environment. Everything above was verified on the web build |
| Health-app data (Apple Health, Health Connect) | **Not built**: those stores can only be read by a native build |
| Strava, Google sign-in, photo label reading | **Need a backend the person runs** (`exposure-awareness-backend`); off by default |
| Sign in with Apple/Google (SSO) | **Deliberately not built** -- local-only v1 |
| App Store / Play Store submission | **Not started** -- needs Apple Developer / Google Play accounts |

## Running it

```bash
cd exposure-awareness-mobile
npm install
npm test          # 552 Jest tests across 49 suites
npx tsc --noEmit  # typecheck
npm run sim       # engine soak run: 4 simulated people x 12 weeks, report + 79 invariant checks
npm run tables    # the "continued use" tables in the walkthrough, from the last sim run
npm run tz        # the whole suite under seven timezones
npm run web:build # a static build of the web app into dist/ (serve it with any static file server)
npm run web       # opens in a browser -- works right now, no Xcode needed
```

`npm run ios` / `npm run android` are wired up but **require Xcode or Android Studio to
be installed on this machine first**. Once Xcode finishes installing, these should work —
worth a fresh attempt then to get real Simulator verification instead of the web-only
path this was built against.

## The wellness score: every part is a comparison

The score is a set of **signals** (`src/engine/signals/`), and each one is a comparison, never a bare
count. A signal returns a value (0-100), how much evidence stands behind it, and the comparison in words:
what was measured, what it was compared with, and how it reads ("On target", "Getting close", "Room to
grow", "Not enough yet"). The Score screen and every receipt can answer "compared with what?".

| Part | Measures | Compared with |
|---|---|---|
| Logged exposure | what carries something flagged, per entry (logging more never counts against you) | the app's reference bands |
| Adding good | sleep, movement, hydration, resets | CDC sleep hours by age; US Physical Activity Guidelines / WHO (150 min a week, 420 for youth); a plain habit rhythm where no guideline exists |
| Validation | how recent and how frequent measured readings are | a routine cadence, and the person's own previous reading |
| Shelf | the products used habitually | the ingredient engine's stance rules |
| Places | answers about home, work and everyday places | US EPA, WHO and US Surgeon General guidance, and the app's own curated guidance where no authority gives a number |
| Understanding | progress through the toxicology curriculum | the whole curriculum |

- **Coverage is separate from the score.** The score is the evidence-weighted average of the parts that have
  evidence; "picture N% filled in" says how much of the whole the app can see. Under 40% the reading is
  labelled an early picture instead of a verdict, so a first week does not read like a judgement.
- **A record's weight fades gently** (half as much every ten days, gone after six weeks), so one quiet week
  nudges the picture rather than erasing it. Every part can also be evaluated "as of" any earlier day from
  one load of the data, which is what makes the comparison with the person's own self four weeks ago, and
  the eight-week history, possible.
- **Every activity factors in, and that is enforced.** `ACTIVITY_ROLE` in `signals/registry.ts` assigns every kind of
  activity to the signals it feeds, or says why it deliberately does not; `STORAGE_ACTIVITY` does the same for
  every AsyncStorage key. Both are exhaustive at compile time, and `registry.test.ts` also scans the source for
  storage keys that skipped registration. Adding a table without saying how it factors into the picture does
  not compile -- this was demonstrated by adding the places table and watching `tsc` and the test fail until it was classified.
- **Receipts.** `runActivity(kind, write)` reads the score before and after, and every screen that records
  something shows the difference: which part moved, what it was compared with, how much fuller the picture is.
  Nothing per-screen to forget: a new activity or signal gets its receipt from the registry.
- **Volatility.** Mean day-to-day movement of the score fell from about 2 to 4.5 points to 0.6 to 1.1, and the
  largest single-day move from 41-49 points to 4-9, measured on the four simulated lives.

## Places: the household, workplace and everyday lens

Where a day is spent matters as much as what is eaten. `src/data/placeChecks.ts` holds 22 plain questions
across three kinds of place (home, work or school, everyday places), each compared with a published reference
whose source is named on screen: the EPA's radon action level, lead and mold guidance, indoor air quality
and air-cleaner guides, the WHO 2021 air-quality guideline, the US Surgeon General's secondhand-smoke report.
Where no authority gives a number, the check says it is this app's own curated guidance.

- **Answers are dated and kept**, never overwritten, so the picture can be compared with an earlier day.
  Answers over a year old still count but carry less evidence; "not sure" is never asked again for a month.
- **A finding is weighted three ways**: the substance's concern level, the hours a week spent in that place
  (home weighs more than a commute), and who shares the space -- the household lens reuses the same
  personalization rules the app applies to the user (pregnancy, asthma, a child, an older adult, a pet), so
  "gas cooking" counts for a little more in a home with an asthmatic housemate. Nothing about housemates
  leaves the device, and none of it is required.
- **It feeds advice as well as the score.** A finding worth attention becomes standing exposure, exactly like
  a product on the shelf, and reaches This week's focus with "In your places: Home: gas cooking". A substance that
  stands both on the shelf and in a place is one decision (the weights add, both origins are named).
- **The loop closes.** Marking a tip done brings the related question back ("has this changed?") until the answer
  is updated, and fixing a thing shows in a receipt and in the comparison with four weeks ago.
- **Tone.** "Worth a look" is amber, never red; nothing is a verdict on the person or the place.

## Learning checks: recall, not just reading

Pressing "Got it" on a lesson is self-reported. A question about it a few days later is recall, and
retrieval spaced out over time is what makes an idea last -- so each of the 22 lessons carries two
questions (`src/data/conceptChecks.ts`, 44 in all, each with the idea behind the answer).

- **Spaced, never punishing.** A question answered right returns after 1, 3, 7, 14, 30, 60 and then every 90
  days; one missed comes back tomorrow with the idea explained again (`src/engine/learningChecks.ts`). No score
  ever falls because of an answer: the Understanding part is the curriculum share plus up to 20 points for
  questions answered right at least once, so practice can only raise it (property-tested, and checked on the
  simulated lives).
- **Where they appear.** After each lesson ("Check what stuck"); one a day under Daily's first step; a review of
  three at a time under Learn > Engine; a single quiet line on the Dashboard when the list of changes is empty
  ("To keep the picture current"); and a Mastery step in the Journey (a question answered on three different days).
  What is offered is a session of three, never the size of the pile.
- **No new storage.** An answer is an ordinary learning event (`check:<question id>:<1|0>`) and goes through
  `runActivity`, so it comes back with the same comparison receipt as everything else. It counts as a day of
  learning for the plant. Old attempts are trimmed per question, never the lessons.

## Readings over time

The Biomarkers screen shows each metric's latest reading against the person's *own* earlier ones
(`src/engine/readings.ts`): the change and its direction, both dates, and a small strip of the last eight
readings scaled to their own range. Two readings in different units are never compared. The app does not
say whether a number is in range (that depends on the lab, the method and the person) and says so on screen.

## Your data, and taking things back

- **Export a copy** (JSON) or **delete everything** under About you; "What leaves this device" lists the four
  public look-ups the app can make (a daily PubMed search for loading-screen titles, barcode look-ups at Open
  Food Facts / Open Beauty Facts, air quality at Open-Meteo and alerts at the US National Weather Service if location is on, and a
  backend the person runs) and what each one carries.
- **Removing an entry is reversible.** Deleting a food, air, sleep or biomarker entry offers "Undo" that stays
  until it is used or dismissed -- it does not time out.
- **Between screens** the app shows a short learning moment; "Straight there" under About you turns them all off.

## Plain language, accessibility, and how they are checked

- **"Simple" keeps its promise.** The hazard summaries read at a college level (median Flesch-Kincaid grade
  about 15.6). Each substance now also has a `summary_plain` (median about 8) that "Simple" shows instead, and a test holds
  them to a reading level, a length, a calm vocabulary, and *no number, year or agency the full summary does not carry*
  (`src/data/plainSummaries.test.ts`; written by `tox-exposure-tool/scripts/add_plain_summaries.py`).
- **Evidence is labelled for what it is.** A study of something close by (ultra-processed food behind a page on food
  dyes) is shown under "Wider context", never as research on the substance itself (`context_substance_ids`).
- **Accessibility spot checks.** `scripts/a11y-audit.js` (paste into the browser console, call `__audit()`) counts
  headings, unnamed or repeated controls, targets under 24px, text under 4.5:1 contrast, tiny text, missing state on
  radios/checkboxes/tabs, and horizontal overflow; `scripts/a11y-walk.js` walks every screen with it. The result for
  the current build is in the walkthrough. This is a spot check for what a screen reader and a low-vision user hit first --
  not a substitute for testing with real assistive technology on a device, which has not been done.

## The engine soak run (`npm run sim`)

`src/sim/` runs four different simulated lives -- an 18-year-old in Seoul, a night-shift nurse
in Chicago, a school principal in Madrid, a pregnant engineer with asthma in San Francisco --
day by day for 12 weeks through the real `db.ts` and the real engine entry points, each in its
own timezone process (Jest cannot switch `TZ` mid-run), on a faked clock. Each person logs like
their life allows, reads the Dashboard, and acts on the engine's own Focus and Quick Wins (or
answers "I'm keeping this"), so engine -> advice -> behaviour -> new logs -> engine is exercised
as a loop. Every persona also runs as a pair of "twins" with an unchanged diet that differ only
in how thoroughly they log, which separates real signal from logging artifacts. `npm run sim`
prints a report and exits non-zero if an invariant breaks; `SIM_SEED`, `SIM_DAYS` and `SIM_OUT`
tune it, and each persona's final local storage is written as `<persona>.snapshot.json` so it can
be loaded into a running app (write it into `localStorage`) to look at a lived-in state.

What it found, and what changed (all with regression tests):

- **The wrong calendar day.** Screens stamped entries with the UTC date. For an evening logger in
  Chicago, 70% of entries landed on tomorrow (73% for the San Francisco persona); the Madrid
  morning check-in user's streak read 0 on 50 of 64 morning opens. Every day key now goes
  through `src/util/dates.ts` (local calendar days), and a streak stays alive until a whole day
  passes without an entry.
- **Look-alike words.** Substring matching read "avocado toast" as VOC off-gassing (one persona's
  Focus named indoor air on 15 days across five weeks), "sugar-free" and "BPA-free" as the thing
  they rule out, and "BPAF" as BPA. Free text is now matched as whole words with plurals and
  negation (`src/engine/textMatch.ts`).
- **A scan is not a meal.** Scanning a product wrote a log entry that landed in that week's
  score while the shelf ledger counted the same product again -- so the weekly score spiked on
  every scan, and advice vanished a week later. Scans now catalog the product; the ledger carries
  it persistently, and Focus draws on both ("standing exposure").
- **Trend labels called noise a trend.** With behaviour unchanged, the Dashboard named a direction
  on 74% of days; it now compares against the person's own week-to-week range and says "no trend
  yet" when logging volume isn't comparable (~9%). It also no longer shows "worsening" in red.
- **"Dialed In" for an empty week.** A week with almost nothing logged now reads "Not enough
  logged yet".

Found and fixed while reworking the score and adding places (79 invariants now checked, including that no recall answer ever lowers Understanding):

- **The score jumped on one flagged meal** (65 to 52), and its first biomarker or first lesson moved it by
  tens of points. The exposure part now leans toward a typical pattern until there is enough to read, and each
  part carries a confidence that ramps with evidence.
- **The shelf part saturated at index 16** (a typical shelf is far above it, so a good swap could not show); then
  its first replacement -- the average burden of the shelf -- turned out to *lower* when a mildly flagged
  product was retired while heavier ones remained (Marcus, 22.6 to 8.6 after retiring three). It is now the
  total burden against an anchor: retiring or swapping away a flagged product can only raise it, scanning a
  clean one can never lower it, and there is no floor for a normal shelf. Randomized tests hold the line.
- **"Not sure" answers were re-asked on every visit** (71 answers from one simulated person about 21 questions).
  A check answered "not sure" is now left alone for a month.
- **A first answer is not a jump.** The places part leans toward a typical place while few things have been
  compared (a fixed amount, so answering more that meets its reference can never lower it), and says so.

Still open (measured, not yet addressed): an unanswered top recommendation stays #1 for weeks
(there is no "decide, or it stops" step yet); some environmental substances have no input path
except free text or the places checklist; free-text recall on meals is low (most ultra-processed
meals named without an ingredient list go unflagged); and the older Python prototype does not have
the score signals or places.

## Design decisions carried over from the web app

- **Local-only, no login required** — matches the free/no-paywall design of the web app.
- **Non-fear-based gamification, extended to quests**: same invariant as the achievement
  catalog — `quests.test.ts` asserts no daily/weekly quest title or id can reference
  score/risk/concern/band vocabulary. Checking things off is one-way (no "losing" a
  completed quest), matching the achievements' non-punitive design.
- **Starter Journey ordering is deliberate, not algorithmic**: frequency/commonness and
  low effort first (tupperware, laundry, shoes-off, range hood), impact-only-matters-most
  items last (radon is the explicit "boss quest") — because a highest-impact-first
  ordering front-loads the hardest asks before any momentum exists, which is the exact
  pattern that gets wellness apps deleted (see the persona-test findings from the
  notification-design pass earlier in this build).
- **Trend graphs stay in the same non-fear register** as the dashboard: labeled "flagged
  mentions," not "risk," with the same dose-not-modeled caveat surfaced right next to the
  chart, and resilience practices charted separately, never netted against the other graph.
- **Quick Wins ≠ This Week's Focus** — deliberately different rankings, verified to
  actually diverge in the ported test suite.
- **The person decides.** Every recommendation can be answered "Mark as done" or "I'm keeping
  this": keeping is a fine answer, it holds that source out of Focus and Quick Wins for 60 days
  (list and undo on the Dashboard), and it is stored apart from completed actions so it can never
  count toward badges or quests. Persistent advice needs a way to be answered "no, thanks".
- **Two separate measurements.** What was logged this week (the awareness band, the scores) and
  what the shelf and the places carry week after week ("standing exposure") are different things.
  Standing exposure feeds advice and the score's Shelf and Places parts -- never the awareness band's
  weekly points -- and a substance that stands on the shelf or in a place shows up once in Focus, with the
  products and places behind it named.

## Known rough edges from the verified passes

- React Native Web's `Pressable` doesn't get an ARIA button role by default — fixed by
  adding `accessibilityRole="button"` everywhere.
- React Native Web 0.21 maps `accessibilityRole` and `accessibilityLabel` but **not** `accessibilityState`: a
  radio, checkbox or tab needs `aria-checked` / `aria-selected` / `aria-expanded` as well, or a screen reader is
  never told what is on. `scripts/a11y-audit.js` counts the ones that are missing.
- Navigation is hand-rolled (`tab` + `overlay` + a `trail` of where each screen was opened from, in `App.tsx`),
  not `react-navigation` or `expo-router`. Back goes back to where the person came from, but there are no deep links
  and no native hardware-back / swipe-back integration -- worth moving to `expo-router` for the native build.
- Every move between screens can show a 3-second learning moment (skippable; "Straight there" under About you turns
  them off). It is a deliberate design choice, and also the largest single cost in the first ten minutes.
- With one Jest worker per core (18 here), a worker process segfaulted (`signal=SIGSEGV`, in a different suite each time,
  never a failing test) in about 1 full run in 12, on Node 24 with Jest 29. The suite is now capped at two workers in
  `package.json`: 0 crashes in 30 runs at two workers and in 16 runs in-band, at the same wall time (about 21 s, most of it
  start-up). If it ever recurs, `npx jest --runInBand` is the fallback.
- `AsyncStorage` needs an explicit Jest mock (`jest.setup.js` +
  `@react-native-async-storage/async-storage/jest/async-storage-mock`) — not wired up by
  `jest-expo`'s preset automatically; discovered when `quests.test.ts` failed with a
  native-module error on first run, fixed rather than worked around.
