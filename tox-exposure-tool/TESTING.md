# Testing Guide: Scenarios & Sample Inputs

Two ways to explore the app:

1. **Fastest path** — auto-populate a realistic week of demo data:
   ```bash
   python3 -m scripts.seed_demo_data --reset
   python3 app.py
   ```
   Then open http://127.0.0.1:5050/dashboard?days=7. This gives you a 7-day logging
   streak, flagged substances in every category, an AQI reading in every band from
   Good to Unhealthy-for-Sensitive-Groups, a produce-diversity tip, and populated
   resilience practices — enough to see every dashboard section at once.

2. **Manual path** — the scenarios below, for testing one feature at a time or
   understanding *why* a particular input produces a particular result.

Each scenario names the exact input, where to enter it, and what you should see.

---

## 1. Substance matching from free text (Food)

**Where:** Food → Food item(s)
**Input:** `cereal with red 40, orange juice, browned toast bagel`
**Expect:** Dashboard → Food category flags **Artificial food dyes** (via "red 40") and
**Acrylamide** (via the exact phrase "browned toast" — the matcher is substring-based
against a fixed alias list in `data/hazard_database.json`, not semantic, so "dark
toasted" or "burnt bagel" alone will *not* match; it needs "browned toast" or "burnt
toast" verbatim, or the word "acrylamide" itself). Likewise "sweetened" alone will *not*
match Added Sugar — add `and added sugar` to the input to see that flag too. This
substring-matching limitation is called out in the README as a known v0.1 constraint.

## 2. Real ingredient list matching (Personal Care)

**Where:** Personal Care → Ingredient list
**Input:** `Water, Sodium Laureth Sulfate, Fragrance, DMDM Hydantoin, Citric Acid`
**Expect:** Three flags — **SLS/SLES** (low concern), **Phthalates** (via "Fragrance",
higher concern), **Formaldehyde-releasing preservatives** (via "DMDM Hydantoin", higher
concern). This demonstrates why pasting the real label beats typing a product name alone
— try just `Brand X Shampoo` with no ingredients and note nothing gets flagged.

## 3. Ultra-processed food (UPF) tracking

**Where:** Food → log 2–3 separate entries, each with **Processing level = "4 —
Ultra-processed"** (e.g. `toaster pastry`, `packaged snack cake`, `soda`)
**Expect:** Dashboard → "Food processing mix (NOVA)" table shows Level 4 count ≥ 2, and
**This Week's Focus** surfaces a UPF-specific tip ("Swapping just one for a
minimally-processed alternative...") — distinct from any single-additive tip, since
this is a structural pattern, not a substance match.

## 4. Produce diversity tip (aggregate pesticide-exposure framing)

**Where:** Food → three entries: `strawberries`, `strawberries`, `spinach`
**Expect:** Dashboard → "Produce Variety" section shows 3 watch-list mentions and a tip
about rotating in lower-tier items. Note the **overall score does not change** — this
is informational only, by design (see `engine/produce.py` docstring). Compare against
logging `avocado`, `banana`, `broccoli` instead — no tip appears.

## 5. Mold / indoor environment (highest environment concern level)

**Where:** Environment → Condition = "Mold / musty smell", Detail = `musty smell under
bathroom sink, never fully dried after a leak`
**Expect:** Environment score +3, substance card shows **Indoor mold / mycotoxin
exposure** at "higher" concern, and its mitigation tips (exhaust fans, HVAC inspection,
hygrometer, "consult a certified inspector") appear in Recommendations.

## 6. Air Quality — walking through every AQI band

**Where:** Air Quality → log four separate readings (PM2.5, same location):

| Value (µg/m³) | Expected category |
|---|---|
| 5.0 | Good |
| 20.0 | Moderate |
| 45.0 | Unhealthy for Sensitive Groups |
| 90.0 | Unhealthy |

**Expect:** "Good" contributes nothing to the score (by design — see
`engine/scoring.py`, `air_quality_score` only counts `concern_level >= 1`). The other
three appear in the Air Quality table color-coded, and the two worst show up as focus
items with the exact EPA guidance text for that band.

## 7. Resilience practices are tracked but never netted against the score

**Where:** Log a food item that would flag something (e.g. `bacon` → Sodium nitrite),
note the Food score. Then log a practice (Resets → Fasting window, 720 minutes).
**Expect:** Food score is **unchanged** after logging the practice. The practice appears
in its own "Resilience Practices" table with the honest note distinguishing it from
pseudoscientific "detox" claims. This is covered by
`tests/test_scoring.py::test_practices_tracked_separately_and_not_scored`.

## 8. This Week's Focus ranking + "Mark as done"

**Where:** Log the mold entry from scenario 5 *and* the ingredient list from scenario 2
(which also flags SLS at concern-level 1, alongside phthalates/formaldehyde-releasers at
concern-level 3).
**Expect:** In "All recommendations", every concern-3 item (mold, phthalates,
formaldehyde-releasers) ranks above the concern-1 SLS tip — recommendations sort strictly
by `concern_level`. **Focus Items** takes the top 3 by `concern_level × frequency`; with
several concern-3 items tied on weight, which three make that cut can vary by insertion
order (a tie-break detail, not a bug — see `engine/scoring.py`'s `focus_pool` sort). Click
"Mark as done" on whichever tip is showing; it gets a "done recently" pill and drops
toward the bottom of the focus ranking (but stays visible in "All recommendations" —
it's deprioritized, not hidden). Re-visiting after 14+ days should un-deprioritize it
(see `app.py`'s `since_date` window on `get_completed_action_keys`).

## 9. Logging streak

**Where:** Log at least one entry (any category) on each of several consecutive days.
**Expect:** Homepage and dashboard both show "N-day logging streak." Skip a day and the
streak resets to 0 on next visit (based on `db.get_distinct_log_dates`, which unions all
five log tables by date).

## 10. Learn library — verifying the live-sourced data

**Where:** Learn → expand any substance card, e.g. "PFAS (forever chemicals)"
**Expect:** Real PubMed citations with working links (click through — they resolve to
actual pubmed.ncbi.nlm.nih.gov articles), a PubChem CID link, and GHS hazard statements
explicitly labeled as describing the **pure/concentrated** substance, not the diluted
trace amount in a consumer product. Check `last_synced` date at the bottom of the card.

## 11. Quick Wins vs. This Week's Focus — two genuinely different rankings

**Where:** Log the ingredient list from scenario 2 (SLS + phthalates + formaldehyde-
releasers, all from one shampoo) *and* the mold entry from scenario 5.
**Expect:** **This Week's Focus** is 100% "Indoor mold / mycotoxin exposure" tips (concern
3, but `action_effort: high`). **Quick Wins** is 100% SLS tips instead (concern 1, but
`action_effort: low`) — mold's tips never appear there because every one of its
mitigation tips is tagged high-effort. This is the intended behavior, not a bug: Focus
answers "what matters most," Quick Wins answers "what's easiest to just go do right now,"
and a substance can dominate one list while being entirely absent from the other. Covered
by `tests/test_scoring.py::test_quick_wins_favors_low_effort_over_high_concern`.

## 12. Barcode scan (Open Food Facts integration)

**Where:** Food → "Scan its barcode instead" → enter `3017620422003` (a real,
well-known product barcode) → Look up
**Expect:** A confirm screen pre-filled with the real product name ("Nutella"), its real
ingredient list, and NOVA level 4 auto-selected (Open Food Facts computes this itself).
Submitting logs it through the normal `/log/food` insert path — the ingredients text
lands in Notes, so it gets scanned by the substance matcher exactly like manual entries.
Try a barcode you make up (e.g. `0000000000000`) to see the graceful "not found, try
manual entry" fallback instead of an error page.

## 13. Achievements unlock on the behaviors that matter, not on scores

**Where:** Log your very first entry (any category, e.g. one food item).
**Expect:** A flash message "Achievement unlocked: \U0001F331 First Step..." appears on
the next page load (achievements are evaluated on both `/` and `/dashboard`), and
`/achievements` shows 1/11 with that badge no longer greyed out. Re-visit the dashboard
again without logging anything new — no duplicate unlock message (achievement_key is
UNIQUE in the DB; `tests/test_achievements.py::test_achievement_does_not_unlock_twice`
guards this). Log entries in all 5 categories (food, personal care, environment, air
quality, a practice) to unlock "Full Picture" — note it requires the 5th category
specifically; 4 out of 5 does not unlock it
(`test_full_picture_requires_all_five_categories`).

## 14. Biomarkers are logged but never scored

**Where:** Biomarkers → log "Resting heart rate (bpm)" = 58.
**Expect:** Appears in the Biomarkers table on the dashboard and on the log page's recent
list. It does **not** appear anywhere in `report["category_summary"]`, `overall_score`,
or any achievement's unlock criteria — this is deliberately a parallel, unscored stream
for personal trend-watching (see `ADVANCED_TIER.md` for why: correlating it against the
exposure score would need real statistical rigor this tool doesn't attempt, so it
deliberately doesn't pretend to).

## 15. Logging streak vs. achievement streak badges

**Where:** Log something on 3 consecutive days (today, yesterday, the day before — use
the date picker to backdate two of the entries if testing all in one sitting).
**Expect:** Homepage/dashboard both show "3-day logging streak," and `/achievements`
shows "3-Day Streak" unlocked but **not** "Full Week" (needs 7) or "30-Day Streak" (needs
30) — each streak tier requires its own threshold, not just "any streak > 0."
Skipping a day resets the *displayed* current streak to 0, but an already-unlocked badge
stays unlocked (achievements are one-way; there's no way to "lose" one, by design — see
scenario 13's non-punitive framing).

---

## Re-running the data sync (verifying "accuracy" claims)

To confirm the citation/hazard data is live-pulled and not hardcoded, try changing a
query and re-syncing a single substance:

```bash
python3 -m sources.sync_db --only parabens --dry-run
```

This hits PubMed + PubChem over the network in real time; compare the `references`
returned against what's currently in `data/hazard_database.json` — re-running without
`--dry-run` will refresh them (citation lists can change as new papers are indexed).

## Running the automated test suite

```bash
python3 tests/test_scoring.py       # 14 tests
python3 tests/test_achievements.py  # 5 tests
```

Together: substance matching, UPF scoring, AQI banding (including the "Good doesn't
inflate the score" rule), produce diversity, practice/score separation, mark-as-done
deprioritization, Quick Wins vs. Focus ranking, and the achievement catalog's streak/
category logic plus a design-invariant test that the catalog can never reference scoring
vocabulary. All scenarios above have a corresponding automated test — the manual
walkthrough is for *seeing* the behavior, the test suite is for *guarding* it.
