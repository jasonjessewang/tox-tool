# Store listing: a draft to edit, not to paste

Text for the App Store and Google Play, written in the app's own voice: calm, specific, no medical claims, no fear
words. Every field is inside its store's limit (counted by script on 2026-10-03; recount after any edit). The facts
come from the app as it is; if a feature changes, change this with it. Nothing here has been submitted anywhere.

## Both stores

| Field | Limit | Text |
| --- | --- | --- |
| Name / title | 30 | Exposure Awareness |
| Category | | Health & Fitness (primary), Education (secondary) |
| Privacy policy URL | | `https://jasonjessewang.github.io/tox-tool/privacy.html` |
| Support URL | | the repository's Issues page, or a page you host; the app's own "Send feedback" opens the person's mail app |

## App Store

| Field | Limit | Text |
| --- | --- | --- |
| Subtitle | 30 | Everyday exposures, in context |
| Promotional text | 170 | A calm checkup for the things you eat, use and breathe: see how your week compares with published guidance, and decide what, if anything, to change. |
| Keywords | 100 | toxicology,exposure,ingredients,radon,air quality,lead,indoor air,product scan,health literacy |

## Google Play

| Field | Limit | Text |
| --- | --- | --- |
| Short description | 80 | See your everyday exposures against published guidance. Private, on your device. |

## Description (both; limit 4,000)

Exposure Awareness turns public health guidance into a picture of your own everyday exposures, and the small things
you can change. It is a checkup, not a feed: open it when you want to, and it tells you where things stand.

Every number answers "compared with what?"

- Your places. A few plain questions about home, work and the places in between, each compared with published
  guidance from the US EPA, the WHO and the US Surgeon General. Where no authority publishes a number, the app says
  the guidance is its own.
- Your shelf. Scan a barcode or paste an ingredient list. The app reads it against a database of substances built
  from PubMed and PubChem, weighs how often you use the product, and says what it found and what it could not
  recognise.
- Your week. Log a meal, an air reading, sleep or a lab value. Logging more never counts against you.
- The biggest sources first. First steps start with the few things that matter most for most homes: a radon test,
  smoke-free air indoors, the age of your home's paint, ventilation while you cook.

You decide

Nothing is applied for you. Every suggestion can be answered "Mark as done" or "I'm keeping this", and keeping
something is a fine answer. The score shows how much of your picture is filled in, and what it rests on.

Learn the science behind it

- A toxicology curriculum in short lessons, with a couple of questions on each that come back at wider and wider
  intervals.
- Electives on cancer and prevention (including breast cancer), cosmetics and personal care, and the exposome.
- Research summaries of widely cited papers, each linked to PubMed, with what the study can and cannot tell you.
- Tools you can play with: how a tenfold headline becomes real numbers, how a limit is derived from a study, why
  "linked to" is not "causes".

Private by design

- No account. What you enter stays on your device.
- The app reaches the internet only for public look-ups you ask for (a barcode, local air quality and weather
  alerts), for recent paper titles from PubMed if you turn learning moments on, and for your own server if you
  connect one. About you lists each one.
- Take a copy of your data, or delete all of it, at any time.

Calm by design

No streaks, points, badges or leaderboards. Reminders are off until you turn them on. Light and dark themes.

What it is not

This app is for awareness and learning. It does not diagnose or treat anything, and it does not replace a
clinician. If someone may have swallowed, breathed in or been exposed to something right now, call your local
emergency number or poison centre.

## Notes for App Review (App Store Connect > App Review Information)

This is an awareness and learning tool, not a diagnostic one. It makes no medical claims: scores are described in
the app as "a personal dashboard reading, not a diagnosis", and the scope note and the redirect to an emergency
number or poison centre are shown during setup and again under About you. No login is needed to review it. Location
is requested only if the reviewer turns on local air quality, and only while the app is open. The microphone,
Face ID and motion strings are present because linked frameworks reference those APIs; the app uses none of them,
and each string says so.

## Screenshots still to make

App Store: iPhone 6.9-inch (and iPad 13-inch while `supportsTablet` is `true`). Google Play: at least two phone
screenshots, plus a 1024 x 500 feature graphic. Suggested set, light theme unless noted: the Dashboard; a place with
its questions; a product reading from a scan; a lesson; the research list; About you > What leaves this device; the
Dashboard in dark. Take them from a real build (the Simulator build is fine for iOS), not from the website.
