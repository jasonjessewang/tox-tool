# Soft-launch readiness

*2026-10-02. What's actually missing before putting this in front of real testers, organized by whether it blocks a
soft launch at all, or can wait. Every number below is read from the current code or the last simulation run, not
estimated.*

## The honest short version

**The app itself is ready.** Engine, content, accessibility and security all check out (walkthrough, QA pass). What's
missing is specific to *testing with real people*: there's no way for a tester to tell you something broke, and
nothing catches it if something does. Both are small, bounded builds. Everything else below is either a judgment
call or can wait for a wider launch.

## Blocks a soft launch -- done 2026-10-02

| Gap | Why it matters for *this specifically* | Resolution |
|---|---|---|
| **No in-app feedback channel** | Zero telemetry (by design, see privacy.html) + zero way to report a bug or a confusing screen from inside the app = testers have no way to tell you anything except by messaging you directly and remembering to. The one thing a soft launch needs most. | [src/services/feedback.ts](../src/services/feedback.ts): a "Send feedback" button in About you opens the person's own mail app, prefilled, addressed to the owner -- email rather than a public GitHub issue, since a tester describing what confused them may paste in details from their own logged entries. Unit-tested ([feedback.test.ts](../src/services/feedback.test.ts)); privacy.html's Contact section and the README/badges' stale `exposure-awareness` repo name (should have read `tox-tool`) were fixed alongside it. |
| **No error boundary anywhere in the app** | A single render-time exception white-screens the whole app with no recovery and no "something broke" message. Storage is untouched (it's separate from rendering) but a tester doesn't know that -- they just see a blank screen. Real devices and real people's data/network conditions are exactly where this is most likely to actually happen. | [src/components/ErrorBoundary.tsx](../src/components/ErrorBoundary.tsx), wrapping the app's root in `App.tsx`: a calm "This screen hit a snag" screen (no alarm language, matches invariant 1) with "Try again" and "Send feedback" (prefilled with the error). Verified live by forcing a real render crash and watching the fallback appear and recover, not just by reading the code. |

## Worth doing, not blocking

| Area | What's actually there | Read |
|---|---|---|
| **Goals / pathways to success** | No explicit "pick a goal" step. What exists instead: the Starter Journey (9 steps, biggest sources first), "This week's focus" (always 1-3 items), and the score's six parts, each a comparison. This is an *implicit* pathway (measure -> see what's flagged -> act -> remeasure), not a stated one. | Possibly fine as-is for a short test -- or exactly the kind of thing worth asking testers about before building it blind, rather than guessing at a goal-picker UI now. |
| **Continued learning / content runway** | 22 lessons (3 tiers, mastery-unlock at 80%), 44 recall questions (spaced 1/3/7/14/30/60/90 days, continues indefinitely), 27 Research items, 56 items in the daily "Learn one thing" pool (quotes/history/concepts/insights/guidelines, tier-gated: 35 at tier 1, 50 at tier 2, all 56 at tier 3). | In the 84-day simulation, the most engaged persona (Elena) hit **100% curriculum by day 84** (already 91% by day 60) and read 15 of 27 Research items. The daily pool repeats after 35-56 days depending on tier. **Fine for a 4-6 week soft launch; an engaged tester beyond ~2 months will visibly run out of new lessons**, though recall keeps bringing old ones back on its own schedule. Worth knowing, not worth pre-building more content for a short test. |
| **Education framework** | Already real, not just a label: mastery-based tier unlocking (80% threshold to advance), spaced repetition for recall (same schedule learning research actually uses), three detail levels (Simple/Balanced/Technical) that scale the same content to the reader. This is in better shape than goals/pathways above -- nothing to add here for a soft launch. |
| **Literature refresh** | `sync_db.py` (hazard database citations) and `sync-literature.ts` (backend evidence queue) both work, but **neither is scheduled** -- manual-run only, by design (the script's own docstring explicitly declined to self-schedule a cron job in an earlier pass). Current content is fresh (synced 2026-09-23 to 09-28). | Not stale *today*. Will drift with no one noticing unless either (a) a GitHub Actions cron is added to run it and open a PR with the diff (safe, review-before-merge, and this repo already has one scheduled workflow to pattern off), or (b) you just re-run it by hand every few weeks. Not needed for a short test window. |
| **Native (iOS/Android)** | `eas.json` and both app/package ids are configured; nothing has been built or run on an actual device or simulator anywhere in this project. | A soft launch can be **web-only** -- the live site is the whole app, already tested end to end -- with native as a separate, later wave once an EAS cloud build has actually been tried once. Don't block the web soft launch on this. |

## Can wait for a real/public launch

- **Terms of Service** -- a privacy policy exists and is accurate; a ToS mainly matters at app-store or larger-public scale, not for a small trusted cohort.
- **App Store/Play Store submission readiness** -- screenshots, age rating, review notes. Only needed if the native wave specifically goes through TestFlight/Play Internal Testing rather than, say, sideloading an EAS internal-distribution build directly to a few testers' phones.
- **More content** (lessons, evidence, quotes) -- the runway above is fine for weeks, not months; revisit after the first test window, informed by what testers actually asked about.
- **A changelog / "what's new"** -- not built. Only matters once you're shipping updates *during* an active multi-week test and want testers to notice what changed.

## A reasonable path

1. ~~Build the two blocking items (feedback channel, error boundary)~~ -- done 2026-10-02.
2. Soft-launch **web-only**, to a small group, for **4-6 weeks** (matches the content runway above without anyone visibly running out of new material).
3. Use that window's feedback to decide whether goals/pathways need an explicit UI, before building one speculatively.
4. Start a native EAS build as a parallel, lower-stakes track -- it needs your own Apple/Google accounts either way, so the earlier it starts the less it blocks anything later.
