# Walkthrough: every pathway, from install to twelve weeks of use

*2026-09-26. The web build at phone width (375 x 812, and 320 x 640 for reflow), driven by real taps; four simulated lives for twelve weeks of continued use. Not run on a phone.*

## In one page

I went through the app the way a person would, from a fresh install to the end of a simulated three months, and looked at four things at each step: **content** (is it right, is it readable, is it honest about what it doesn't know), **context** (what it asks for and what leaves the device), **accessibility** (can everyone use it), and **continued use** (what the picture looks like after weeks, and what there is to do next). Everything I could fix from here I fixed and tested; what needs a person with a phone is listed at the end.

What mattered most:

1. **Recall didn't exist, and now does.** A lesson ended at "Got it", which is self-reported. Each of the 22 lessons now has two questions that come back on a widening schedule (1, 3, 7, 14, 30, 60, then every 90 days); a miss returns tomorrow and no score ever falls because of an answer. They appear after a lesson, once a day in Daily, as a review of three under Learn, on the Dashboard when nothing else needs doing, and as a Journey step. On the simulated lives, the one who read the whole curriculum kept answering for the full twelve weeks (139 answers, 77% right the first time), so the curriculum no longer ends when the last lesson does.
2. **Some evidence was attached to the wrong thing.** Two studies of ultra-processed food were shown as "Research behind this" on the pages for *artificial food dyes* and *added sugar*, though no dye or sugar was tested. Nine studies had 11 such links; they now sit under **Wider context** with a line saying they looked at something close by. Research pages also now show a study's limitations beside its findings instead of behind a tap.
3. **"Simple" wasn't simple.** The hazard summaries read at a college level (median Flesch-Kincaid grade 15.6). All 36 now have a plain-language version that "Simple" shows (median grade 8.2), and a test holds them to a length, a calm vocabulary, and no number, year or agency the full summary doesn't carry.
4. **A toxicology app has to say what to do when it's urgent.** Nothing on first run said the app isn't a clinician, or that someone who may have swallowed or breathed in something should call a poison centre instead of opening an app. It does now, on the last setup screen and under About you.
5. **The first ten minutes cost about 40 seconds of forced waiting.** The launch shows a 5.5-second learning moment; every move between screens shows a 3.2-second one (skippable, but only by finding a small "Skip"). I made them a choice ("Straight there" under About you), and a person who chooses it also stops the daily PubMed request that only feeds those screens. I did not change the default.
6. **Accessibility: walking every screen with an audit script found 16 unnamed 22-pixel checkboxes on the quests screen, and buttons that all shared one name** ("Delete" x10 on each of four log screens, "Bring back" x6 on the Dashboard, "Edit" and "Remove" for each household member, "Listen" x3), all now fixed. Across the 39 screens of the final walk, and again at 320 px, there are no unnamed or repeated controls, no targets under 24 px, no text under 4.5:1 contrast, no text under 11 px, no radio, checkbox or tab without its state exposed, and no horizontal overflow. This is a spot check, not a screen-reader test.

Checks after all of this: 552 Jest tests (49 suites; the same suite under seven timezones), TypeScript clean, 79 invariants on the simulated lives, backend 28 tests, Python tool 33 tests.

## 1. How this was done, and what it cannot show

- **The app** was the Expo web build, in the built-in browser at 375 x 812 (a phone) and 320 x 640 (the reflow width). Every screen was reached by tapping, not by calling code.
- **A new person** was a cleared browser store and a fresh launch. **A person with history** was one of the four simulated lives' final storage loaded into the browser.
- **The four lives** (`npm run sim`) use the real storage layer and the real engine for 84 days each, in their own timezones, acting on the engine's own advice, and now also answering the recall questions. Every table below comes from `node scripts/walkthrough-tables.mjs`, not from my hand.
- **Accessibility** was checked with `scripts/a11y-audit.js` (what a screen reader and a low-vision user meet first) and walked across every screen with `scripts/a11y-walk.js`.
- **Not done, and it matters:** no VoiceOver or TalkBack, no switch control, no dynamic type on a device, no native build, no camera scan, no push notification. A spot check cannot say whether a reading order makes sense or whether focus lands well after a screen change. Those need a person with a phone.

## 2. The pathways

| # | Pathway | How a person gets there | What it does |
|---|---|---|---|
| 1 | **Launch and setup** | open the app | a 5.5 s learning moment, a short optional intake, a "first steps" screen (detail level, location alerts, reminder time), then the Dashboard |
| 2 | **Dashboard** | first tab | the score (or "not yet"), the next Journey step, the plant, awareness, places, "Do next" (focus, quick wins, kept), trends, resilience |
| 3 | **Daily** | second tab | four steps: learn one thing (and one recall question), add something good, today's numbers, reflect and plan (and one question about a place) |
| 4 | **Weekly** | third tab | the week day by day, insights, a topic, a self-assessment |
| 5 | **Learn** | fourth tab | Topics (36 substance pages), Research (27 summaries), Engine (22 lessons, five tools, recall, "see your engine run"), Concepts (audio) |
| 6 | **Journey** | the next-step card | hub of eight ways in, tutorial quests, roadmap; Tutorial (9), Explore (6), Mastery (6) |
| 7 | **Scan** | Journey > Scan | barcode number, pasted label text, (photo needs a backend), product review, add to shelf |
| 8 | **Log** | Journey > Food / Sleep / Air / Biomarkers | free-text entries, each with a receipt, a recent list, undo |
| 9 | **Places** | Journey > Places, Dashboard, Daily | 22 questions across home, work and everyday places, each compared with a named reference |
| 10 | **Shelf** | Journey > Shelf | the products used habitually and how often |
| 11 | **Score** | tap the score | six parts, each a comparison; coverage; eight weeks of history; adjustable weights |
| 12 | **About you** | Journey > About you | profile, detail level, location, reminder, learning moments, export or delete everything, what leaves the device, the app's rules |

## 3. First run: install to first value

| Step | What a new person sees | Cost |
|---|---|---|
| Launch | a "moment in history" card, a progress bar, "Skip" | 5.5 s unless skipped |
| Intake | "A few quick things": age, sex, weight, height, pregnancy, conditions; **all optional**; "stays on this device and is never sent anywhere" | 3 fields and Continue |
| Intro | the nine tutorial quests, four short explainers, detail level, location alerts (off), a reminder time (midday, changeable), and (new) what the app is and isn't | one long scroll and "Start My Journey" |
| Dashboard | the gauge reads **"not yet"** and "Early picture ... 0% filled in"; the next step; a seed | |
| First meal logged | "Saved. Your picture is 3% filled in so far -- this is an early reading. Logged exposure pattern: a first reading -- 63 out of 100, **from very little so far, so it will settle as more comes in**." | 4 taps from the Dashboard |

Things I found and changed on this path:

- A number appeared after four entries (89 out of 100) that said almost nothing. The gauge now shows a dash until the picture is 20% filled in, and the first receipt says in the same breath that a first reading rests on very little.
- A first reading of "100 out of 100" for logging a biomarker read like a verdict on the reading. It now says: "how up to date your readings are, not what they show."
- The launch screen made **zero network requests** and the whole setup makes none: the daily PubMed request now waits until setup is finished (verified with a cleared store, ten seconds in).
- The scan screen showed "2 · Photograph the label" as a step, though it needs a backend most people don't run. It is now a footnote unless a backend is connected.
- The "Connect" tile led to four sources none of which could be switched on from a fresh install. It is now a quiet "Connected sources (advanced)" link.
- Processing level (NOVA 1 to 4) had no explanation on the Food screen. It has one line.
- Back always went to the Journey hub, whatever it was labelled, and the Score screen had a second, different back. Back now goes back to where the screen was opened from and says so ("Back to Your places").

## 4. Content

**What's in it:** 36 substance pages (food 11, personal care 10, environment 15), 27 research summaries, 22 lessons, 44 recall questions, 22 place checks (each compared with a named reference), five interactive tools.

**Reading level (Flesch-Kincaid, a rough measure):**

| Text | Median grade |
|---|---|
| Substance summaries, before | 15.6 (none at or below grade 9) |
| Substance summaries, "Simple" now | 8.2 (worst 11.4: formaldehyde, asbestos and carcinogen are hard to avoid) |
| Lessons | 8.6 (range 3.1 to 15.1) |
| Recall questions / explanations | 8.5 / 9.1 |

**Honesty about evidence.** Ultra-processed-food studies were shown as research on dyes and on added sugar. A study is now either *about* a substance or *background for* it (`context_substance_ids`), the two never overlap (tested), and background is shown under "Wider context: these studies looked at something close by, not at this exactly -- useful background, not a test of it." The backend seeds and API carry the same field. A study's limitations now appear beside its findings, not behind "Read the details".

**Small corrections found by reading:** the PM2.5 summary sent people to "Environment > Air Quality", a place the app no longer has (it is Journey > Air); two tips used shorthand only a specialist knows (EDC, THM) and now spell it out; one recall explanation said "the study" with no study in view and now names it.

**Tone.** New wording is held by string tests to stay calm: no fear vocabulary in the recall feedback, the plain summaries, the readings text, or the urgent note. A wrong answer says "Not quite -- that's what practice is for. It comes back tomorrow."

**Scope and urgency (new).** "This app is for awareness and learning ... It doesn't diagnose or treat anything, and it doesn't replace a clinician. If someone may have swallowed, breathed in or been exposed to something harmful right now, don't use the app: call your local emergency number or poison centre (in the US, Poison Help: 1-800-222-1222)." On the last setup screen and under About you; one source, tested.

## 5. Context and privacy

The app's own list (About you > What leaves this device) matches the code: I searched every network call in `src` and there are exactly these, plus links the person taps.

| Request | When | What it carries | Stops when |
|---|---|---|---|
| NCBI E-utilities (PubMed) | once a day, **after setup**, if learning moments are on | nine public search terms; no user data (your network address, as with any request) | "Straight there" is chosen |
| Open Food Facts / Open Beauty Facts | when a barcode is looked up | the barcode number | nothing is looked up |
| Open-Meteo, US National Weather Service | only if location alerts are on | coordinates | location is off |
| A backend the person runs | only if one is configured | what they choose to sync | it is removed |

Everything else stays on the device: the profile, every log, the shelf, places, the score, learning. **Export a copy** (a plain JSON file) or **delete everything** under About you. Removing a food, air, sleep or biomarker entry now offers **Undo**, which stays until it is used (no timer), since deleting user data without a way back fails WCAG 3.3.4.

## 6. Accessibility

### Scorecard, final build (39 screens; the same at 320 px)

| Check | Result |
|---|---|
| Exactly one h1, no skipped heading level | 39 of 39 |
| Controls without an accessible name | 0 |
| Controls sharing a name ("Delete", "Bring back", "Edit") | 0 |
| Targets under 24 x 24 px | 0 |
| Text under 4.5:1 contrast (3:1 large) | 0 |
| Text under 11 px | 0 |
| Radios, checkboxes, tabs without state exposed to assistive tech | 0 |
| Horizontal overflow at 320 px (WCAG reflow) | none |
| Keyboard focus visible | yes (checked with Tab) |

When the walkthrough began the Dashboard had no headings, the intake form had three unlabelled inputs, 45 text runs were under 11 px, some text failed contrast, and React Native Web was silently dropping `accessibilityState`, so no radio, tab or toggle told assistive technology whether it was on (30 sites converted to `aria-checked` / `aria-selected`).

### Found by the full walk and fixed

- **Quests screen: 16 unnamed, 22 px checkboxes**, and each daily and weekly row was a button holding a button. Now named checkboxes at 28 px, one control per row.
- **"Delete" x10 on each log screen, "Bring back" x6 on the Dashboard, "Edit" and "Remove" on each household member, "Listen" x3**: each now names its item.
- **Headings:** none on the research page, the product review or its "Added" state; four h1s on an audio page; two h1s on Learn > Research; section labels on substance pages were plain text. Fixed.
- **Recall feedback** is announced as a polite live region without the button that follows it.
- **The back link** said "Journey" wherever you were; there were two backs on the Score screen (above).
- **Deleting had no undo.**

### What a spot check cannot tell

Whether reading order and focus after a screen change make sense; how the live regions sound; whether the labels I wrote read well aloud; dynamic type and switch control on a device; the camera scan. **Someone should go through the app once with VoiceOver or TalkBack.**

## 7. Continued use: twelve weeks, four lives

Read the tables as: what a person's picture would show on that day of using it. A dot means the app has no evidence for that part yet; a dash means the picture is under 20% filled in, so no number is shown.

| Life | Opened the app on |
|---|---|
| Mina, 18, student, Seoul | 28 of 84 days |
| Marcus, 35, night-shift nurse, Houston | 26 of 84 days |
| Elena, 55, school principal, Madrid | 64 of 84 days |
| Priya, 31, engineer, 20 weeks pregnant with asthma, San Francisco | 36 of 84 days |

### Mina, 18 -- first-year university student, Seoul

Logged 63 meals, 31 habit entries, 5 air readings and 2 biomarkers; scanned 12 products; read 8 lessons and answered 30 recall questions; answered 23 questions about their places.

| Day | Score | Reading | Picture filled in | Exposure | Habits | Validation | Shelf | Places | Understanding | Curriculum | Recall (right of read) | Plant | This week's focus |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | — | Early picture | 11% | 86 | 49 | · | 91 | · | · | 0% | · | Seed | 2 items |
| 2 | 81 | Early picture | 20% | 89 | 74 | · | 80 | · | · | 0% | · | Seed | 3 items |
| 7 | 77 | Early picture | 35% | 88 | 79 | · | 59 | · | · | 0% | · | Seed | 3 items |
| 14 | 76 | Strong | 58% | 93 | 90 | · | 39 | 90 | 10 | 9% | 2 of 4 | Sprout | 3 items |
| 30 | 70 | Strong | 75% | 75 | 74 | 100 | 39 | 83 | 21 | 18% | 6 of 8 | Sprout | 3 items |
| 60 | 70 | Strong | 65% | 87 | 55 | 100 | 37 | 83 | 37 | 32% | 11 of 14 | Seedling | 3 items |
| 84 | 68 | Strong | 58% | 78 | 42 | 100 | 37 | 82 | 42 | 36% | 13 of 16 | Seedling | 3 items |

### Marcus, 35 -- hospital nurse on rotating shifts, Houston

Logged 54 meals, 23 habit entries, 1 air reading and 3 biomarkers; scanned 9 products; read 2 lessons and answered 2 recall questions; answered 12 questions about their places.

| Day | Score | Reading | Picture filled in | Exposure | Habits | Validation | Shelf | Places | Understanding | Curriculum | Recall (right of read) | Plant | This week's focus |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | — | Early picture | 0% | · | · | · | · | · | · | 0% | · | Seed | 0 items |
| 2 | — | Early picture | 0% | · | · | · | · | · | · | 0% | · | Seed | 0 items |
| 7 | 66 | Early picture | 29% | 84 | 51 | · | 61 | · | 5 | 5% | 0 of 2 | Seed | 3 items |
| 14 | 64 | Strong | 44% | 88 | 65 | · | 38 | · | 5 | 5% | 0 of 2 | Sprout | 3 items |
| 30 | 62 | Strong | 62% | 77 | 56 | 100 | 41 | 37 | 5 | 5% | 0 of 2 | Sprout | 3 items |
| 60 | 51 | Steady | 52% | 77 | 20 | 100 | 44 | 28 | 9 | 9% | 0 of 4 | Sprout | 3 items |
| 84 | 59 | Steady | 54% | 89 | 22 | 100 | 44 | 40 | 9 | 9% | 0 of 4 | Sprout | 3 items |

### Elena, 55 -- school principal preparing to retire, Madrid

Logged 212 meals, 126 habit entries, 12 air readings and 4 biomarkers; scanned 11 products; read 22 lessons and answered 139 recall questions; answered 22 questions about their places.

| Day | Score | Reading | Picture filled in | Exposure | Habits | Validation | Shelf | Places | Understanding | Curriculum | Recall (right of read) | Plant | This week's focus |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | — | Early picture | 13% | 82 | · | · | 100 | · | 6 | 5% | 1 of 2 | Seed | 0 items |
| 2 | 76 | Early picture | 28% | 83 | 41 | · | 100 | · | 10 | 9% | 2 of 4 | Sprout | 0 items |
| 7 | 86 | Excellent | 76% | 88 | 99 | · | 64 | 94 | 16 | 14% | 5 of 6 | Sprout | 3 items |
| 14 | 84 | Excellent | 85% | 91 | 96 | 100 | 64 | 82 | 32 | 27% | 11 of 12 | Sapling | 3 items |
| 30 | 92 | Excellent | 87% | 96 | 95 | 100 | 100 | 82 | 58 | 50% | 18 of 22 | Full-grown | 2 items |
| 60 | 92 | Excellent | 89% | 92 | 87 | 100 | 100 | 85 | 100 | 91% | 25 of 40 | Full-grown | 0 items |
| 84 | 94 | Excellent | 94% | 96 | 89 | 100 | 100 | 85 | 100 | 100% | 34 of 44 | Full-grown | 2 items |

### Priya, 31 -- software engineer, 20 weeks pregnant with asthma, San Francisco

Logged 86 meals, 69 habit entries, 11 air readings and 2 biomarkers; scanned 13 products; read 9 lessons and answered 42 recall questions; answered 31 questions about their places.

| Day | Score | Reading | Picture filled in | Exposure | Habits | Validation | Shelf | Places | Understanding | Curriculum | Recall (right of read) | Plant | This week's focus |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | — | Early picture | 17% | 89 | 49 | · | 90 | · | · | 0% | · | Seed | 1 item |
| 2 | — | Early picture | 17% | 89 | 47 | · | 90 | · | · | 0% | · | Seed | 1 item |
| 7 | 71 | Early picture | 25% | 88 | 55 | · | 90 | 64 | · | 0% | · | Seed | 3 items |
| 14 | 73 | Strong | 70% | 95 | 93 | · | 37 | 69 | 10 | 9% | 3 of 4 | Sprout | 3 items |
| 30 | 78 | Strong | 79% | 94 | 88 | 100 | 58 | 69 | 27 | 23% | 8 of 10 | Seedling | 3 items |
| 60 | 66 | Strong | 69% | 72 | 47 | 100 | 48 | 75 | 37 | 32% | 10 of 14 | Sapling | 3 items |
| 84 | 79 | Strong | 74% | 88 | 52 | 100 | 88 | 75 | 47 | 41% | 12 of 18 | Full-grown | 3 items |

**What the tables show**

- **Honest early days.** No life sees a number on day 1, and none sees "Excellent" until the picture is more than a third filled in. Mina's shelf part *falls* from 91 to 39 in her first two weeks because she scans eight products and the app reads them; that is the app finding things, not her getting worse, and the receipts say so.
- **Acting on the advice moves the picture.** Priya took 11 recommendations and retired 7 products: her shelf index fell from 116 to 6 and the Shelf part rose from 33 to 88. Elena's fell from 43 to 0. Marcus took 3 (99 to 78). Mina took 1, kept 7, and her shelf index went 125 to 108. Where a person keeps or ignores the advice the picture does not move, which is the person's right and is shown as it is.
- **Low use is shown as low evidence, not as failure.** Marcus opened the app on 26 days and read two lessons; his Understanding reads 9 with 9% of the evidence behind it, not "0". His habits part falls to 20 as he stops logging sleep and water, and the reading says "Steady".
- **The ceiling.** Elena reaches 94 with an empty list of changes from day 60. That is where the new "To keep the picture current" line takes over: questions ready for review, a biomarker more than three months old, questions about places not yet answered.
- **Score movement once the picture is trusted:** 0.5 to 1.1 points a day on average, at most 9 in a day and 13 in a week.

**A finding still open:** a top recommendation nobody answers stays at #1 for weeks (74 days for Mina, 32 for Marcus and Priya, 14 for Elena). There is no "decide, or it moves on" step yet.

## 8. Health data: what is aggregated

Every entry is stored locally, dated, and read by six **signals**. Each returns a value, how much evidence stands behind it, and the comparison in words. From Priya's Score screen:

| Part (weight) | What she sees |
|---|---|
| **Logged exposure pattern** (25%) | 88 -- "About 1.1 flagged points per 10 recent entries -- light. Compared with the reference bands: under 1.5 per 10 entries reads as light, under 3.5 as moderate." |
| **Adding good** (20%) | 50 -- Sleep 8 h 02 min on the nights logged against CDC's 7 or more hours; movement 58 minutes a week against 150 (US Physical Activity Guidelines and WHO); hydration 1.4 days a week against a routine of 5; resets none logged (left out, not scored as zero) |
| **Checked against your body** (10%) | 100 -- "This number is how up to date your readings are, not what they show." |
| **Shelf** (15%) | 88 -- "5 of 6 reasonable, 1 fine in moderation, 0 worth swapping" |
| **Places** (20%) | 75 -- the apartment "6 of 12 checks meet the reference, 6 worth attention", each place with the guidance it was compared with |
| **Understanding** (10%) | 47 -- 9 of 22 lessons, 12 of 18 recall questions answered right (6 not tried yet) |

Plus: "picture 73% filled in", "+13 against yourself 4 weeks ago", and eight weekly bars of the score read from the same records. Each part can be weighted differently under "Adjust weights".

**Built in this walkthrough: readings over time.** The Biomarkers screen was a list. It now shows each metric's latest reading against the person's *own* earlier ones ("Resting heart rate: 66 bpm on 2026-09-20, lower than your 84 bpm on 2026-09-09 (-18)"), a strip of the last eight readings scaled to their own range, and refuses to compare two readings in different units ("Your earlier reading was in a different unit (mmol/L), so the two are not compared"). It never says whether a number is in range: that depends on the lab, the method and the person, and the screen says so.

**Not aggregated (by design or not yet):** no correlation across domains (sleep against mood, air against symptoms); no reference ranges for biomarkers (by design); mood appears only as a comparison with the week before; the score history covers eight weeks; the only export is a JSON file (there is no "bring this to your clinician" summary).

## 9. Pathways for getting better

| Where a person is | What the app offers next |
|---|---|
| Day one | nine tutorial quests, easiest first, each a real household change; the first meal, product or biomarker each returns a receipt |
| Week one | "This week's focus" (three things) and Quick wins, each answered "Mark as done" or "I'm keeping this" (60 days, undoable); Daily's four steps |
| Weeks two to four | Places (each answer compared with a reference; a fix brings the question back to confirm it), the Shelf (a swap lifts the Shelf part, shown in a receipt), a first biomarker |
| Month two and after | Explore and Mastery steps; research summaries; the whole curriculum, then recall |
| When the list is empty | "To keep the picture current": a review of three questions, a biomarker more than about three months old, unanswered place questions. Never invented: with nothing to say, it says nothing |

## 10. Learning checks

**Before:** a lesson ended at "Got it"; the curriculum ended when the last lesson did; the Understanding part was progress and nothing else.

**Now:** 44 questions (two per lesson, each with the idea behind the answer, about grade 9). Right answers come back after 1, 3, 7, 14, 30, 60 and then every 90 days; a miss comes back tomorrow. They appear: after each lesson ("Check what stuck"); once a day in Daily's first step; as a review of three under Learn > Engine; on the Dashboard when the list of changes is empty; and as a Mastery step (a question answered on three different days).

**Design choices:** no answer ever lowers a score (the Understanding part is the curriculum share plus up to 20 points for questions answered right at least once, property-tested); the offer is always a session of at most three, never the size of the pile (a count of everything waiting makes it feel like a debt); answers are ordinary learning events, so they need no new storage and come back with the same comparison receipt; a slip after a right answer does not take the credit back.

**On the four lives:** Elena answered 139 questions over the twelve weeks, 107 right the first time, and finished with Understanding at 100 and 34 of 44 questions answered right at least once. Marcus answered two. No answer lowered Understanding on any life, and questions were only ever asked about lessons that had been read.

**A limit:** these are multiple-choice, so they test recognition more than free recall.

## 11. Fixed and open

**Fixed in this walkthrough**

- Recall questions: after each lesson, in Daily, as a review, on the Dashboard, in the Journey.
- Evidence attached to the wrong substance; study limits hidden behind a tap.
- "Simple" mode text at college level; jargon in two tips; a stale menu path.
- No scope or urgent-help statement on first run.
- A first-reading number read as a verdict; a number shown at 3% coverage.
- The launch and every screen change forced a wait; now a choice, and the PubMed request that feeds them stops with it and waits for setup.
- Unnamed, repeated, undersized, headingless and state-less controls (list above); deleting without undo; a back link that said the wrong place.
- Dead ends: the Connect tile, the photo option without a backend.
- Quests completed by real activity were not credited until the next Dashboard load; scans were missing from the weekly digest; sleep entered as "7" was read as minutes.
- A latent data-loss bug: recording a learning event kept only the newest 500 events of any kind, which would eventually have erased the record of which lessons had been read.
- Data control: export a copy, delete everything, what leaves the device.

**Open**

| Item | Why it matters | What would close it |
|---|---|---|
| No screen-reader, device or dynamic-type testing | the spot check can't judge reading order, focus or live-region behaviour | someone with VoiceOver or TalkBack goes through it once |
| Native build, camera scan and push notifications not run | web only here | a device or simulator |
| The learning moment is on by default | it is the largest cost in a first session (about 40 s of ten screens) | decide whether the default should be first-N-per-session, or off after two skips |
| An unanswered top recommendation stays #1 for weeks | advice fatigue (74 days for one life) | a "decide, or it moves on" step |
| Recall is recognition, not free recall | 44 multiple-choice questions | a short free-text prompt on some lessons |
| Weak citations for SLS, formaldehyde releasers, siloxanes and talc | the references were curated for 12 other topics | a curation pass like the last one |
| Photo label reading, Strava, Google sign-in need a backend; Apple Health and Health Connect need a native build | off by default | none needed for v1 |
| The Python prototype has no score signals, places or recall | the two have diverged | port or retire it |
| A Jest worker segfaulted in about 1 full run in 12 (a different suite each time, never a failing test) | Node 24 with Jest 29 and one worker per core | capped at two workers: 0 crashes in 30 runs; `--runInBand` is the fallback |

## 12. Reproduce

```bash
npm test                                  # 552 tests, 49 suites
npm run typecheck
npm run tz                                # the suite again under seven timezones
npm run sim                               # four lives x 84 days, 79 checks
npm run tables                            # the tables in section 7
npm run web                               # the app, in a browser
npm run snapshots                         # serves a simulated person's storage and the audit scripts to that browser
#   then, in the browser console, follow the header of scripts/snapshot-server.py to load a person, and:
#   (0, eval)(await fetch('http://127.0.0.1:8765/scripts/a11y-audit.js').then(r => r.text()));
#   (0, eval)(await fetch('http://127.0.0.1:8765/scripts/a11y-walk.js').then(r => r.text()));
#   await __walk()     // choose "Straight there" under About you first, so moving between screens does not stop on a learning moment
(cd ../exposure-awareness-backend && npm test)   # 28 tests
(cd ../tox-exposure-tool && python3 -m pytest -q tests)   # 33 tests
```
