# Exposure Awareness Tool

A local, single-user web app for tracking day-to-day toxicology-relevant exposures —
diet, personal care products, environmental conditions, air quality, and resilience
practices — and fusing them into a single, non-fear-based awareness picture with
practical, ranked recommendations, plus a Learn library backed by live-pulled citations
and light gamification to make it stick as a habit rather than a one-off audit.

**This is an educational awareness aid, not a diagnostic or medical device.** It does
keyword/threshold matching against a curated reference database; it does not measure
actual exposure levels, doses, or biological effect. See the disclaimer in the app footer.

## Design principles

- **Non-fear-based.** "Awareness Level" bands use plain, non-alarming language (no
  "elevated"/"danger" styling). No achievement rewards a low exposure score, and none
  punishes a high one — the gamification layer rewards *behavior* (logging consistency,
  taking action, resting), never the content of what got logged.
- **Actionable over exhaustive.** This Week's Focus (concern-ranked) and Quick Wins
  (effort-ranked) are deliberately different lists — "what matters most" and "what's
  easiest to just go do" are different questions, and a behavior-change program that only
  ever shows the scariest thing first tends to be less effective than one that also
  surfaces the free/five-minute win.
- **Accurate over convenient.** The hazard database's citations and hazard classifications
  are pulled live from PubMed/PubChem (see `sources/`), not hand-typed, and every claim in
  this codebase's docs has been checked against the actual running engine before being
  written down (see `TESTING.md`'s verification notes).
- **Dose is not modeled.** `concern_level` reflects how consistently something is flagged
  in public-health guidance, not a dose-adjusted risk. GHS hazard statements in the Learn
  library are explicitly labeled as describing the pure/concentrated substance, not a
  diluted trace amount in a consumer product.

## What's built

### Logging streams
- **Food** — free text + optional NOVA processing level (1–4), or scan a barcode
  (`/log/food/scan`, via the free Open Food Facts API) to auto-fill the ingredient list
  and NOVA level from a real product database instead of typing it out.
- **Personal care products** — paste a real ingredient list for accurate matching.
- **Environment** — home/workplace conditions (mold, HVAC, VOCs, humidity, etc.).
- **Air quality** — PM2.5/PM10 readings classified against the EPA's 2024 AQI breakpoints
  (verified directly against the EPA's own fact sheet PDF — see `data/aqi_breakpoints.json`).
- **Resilience practices** — fasting windows, exercise, screen-free time, grounding/
  stretching. Tracked in their own section and **never** netted against the exposure
  score — see the in-app note distinguishing this from pseudoscientific "detox" claims.
- **Biomarkers** (optional) — a place to log wearable/lab metrics (HRV, resting heart
  rate, grip strength, VO2max, lab panel results) for anyone with the means/interest to
  track them. Purely informational, never scored — see `ADVANCED_TIER.md`.

### Hazard/ingredient reference database
[data/hazard_database.json](data/hazard_database.json) — **34 substances/conditions**
across food, personal care, and environment, each with:
- a plain-language summary and mitigation tips (curated, editorial),
- `action_effort` / `action_impact` tags (low/medium/high) driving the Quick Wins ranking,
- `references[]` — real PubMed citations (title, journal, year, PMID, DOI), pulled live,
- `regulatory{}` — PubChem CID/CAS + deduplicated GHS hazard statements, pulled live.

Sync/refresh any time with `python3 -m sources.sync_db` (see below) — this is the
"pulls from latest scientific sources" mechanism, using PubMed (which indexes Nature,
Elsevier/ScienceDirect, and Cochrane Database of Systematic Reviews articles) and PubChem
(NIH/NLM, aggregating EPA CompTox / OSHA / GHS data), both fully open with no API key.

### Fusion + scoring engine ([engine/scoring.py](engine/scoring.py))
Matches free text against the hazard DB, classifies air quality readings, tracks NOVA/
ultra-processed food patterns, tallies produce diversity (informational, never scored —
see `engine/produce.py`), and fuses it all into:
- an overall score + **Awareness Level** band (Dialed In / On Track / Some Room to
  Improve / Good Focus Area),
- **This Week's Focus** — top 3 recommendations by `concern_level × frequency`,
- **Quick Wins** — top 3 low-effort recommendations by impact, a genuinely different
  ranking from Focus (see `TESTING.md` scenario for a worked example),
- a "Mark as done" action-tracking loop (deprioritizes but never hides a completed tip).

### Gamification ([engine/achievements.py](engine/achievements.py))
An 11-badge catalog + logging streak, all rewarding constructive behavior only
(consistency, taking action, resting, diversifying produce) — see the design-invariant
test in `tests/test_achievements.py` that asserts no achievement's text can reference
scoring/risk vocabulary at all.

### Learn library (`/learn`) — tiered for a general audience *and* a technical one
Every substance as an expandable card: plain-language summary (always visible, aimed at
anyone), mitigation tips, live GHS hazard statements (explicitly caveated as
pure-substance/industrial classifications), and real clickable PubMed citations. A nested
"Go deeper (mechanism / technical)" disclosure reveals a substance-specific technical note
(e.g. radon's alpha-decay mechanism, PFAS's renal-transporter-mediated persistence,
acrylamide's CYP2E1 bioactivation to glycidamide) plus linked entries from a 9-concept
shared glossary ([data/concepts.json](data/concepts.json): aggregate exposure,
bioaccumulation/half-life, hepatic metabolism, renal clearance, particle deposition
physics, endocrine disruption, dose-response, NOVA classification, alpha radiation) — each
concept written once in both general and technical registers rather than repeated
per-substance. See `scripts/add_technical_notes.py` for the substance→concept mapping.

### Advanced tier
[ADVANCED_TIER.md](ADVANCED_TIER.md) — a design doc (not a paywall, nothing in-app is
gated) on what someone with more resources could layer on top: home automation, wearables,
CGM, DEXA, grip strength, and a plain-language rundown of periodic blood/urine/stool
testing categories that exist in the market, with an explicit caution against over-testing.

Local SQLite storage, no external services required beyond the optional PubMed/PubChem/
Open Food Facts calls, no accounts, no paywall.

## Running it

```bash
pip install -r requirements.txt
python3 app.py
```

Then open http://127.0.0.1:5050. Data is stored in `exposure_log.db` (SQLite, created on
first run) in this directory.

**Fastest way to see everything at once:**
```bash
python3 -m scripts.seed_demo_data --reset
python3 app.py
```
Populates a realistic 7-day dataset across all five logging streams. See `TESTING.md`
for manual scenarios that exercise one feature at a time instead.

## Refreshing the hazard database from live sources

```bash
python3 -m sources.sync_db                       # refresh all 34 substances
python3 -m sources.sync_db --only parabens        # refresh just one
python3 -m sources.sync_db --only parabens --dry-run   # fetch without writing
```

## Running the test suite

```bash
python3 tests/test_scoring.py        # 15 tests: matching, scoring, Quick Wins, concept tags, etc.
python3 tests/test_achievements.py   # 5 tests: achievement catalog + streak logic
```

## How matching works (and its limits)

Each logged entry's text fields are lowercased and checked for substring matches against
each hazard database entry's name and aliases (e.g., "fragrance" flags Phthalates,
"dmdm hydantoin" flags Formaldehyde-releasing preservatives). This is deliberately simple:

- **It rewards specificity.** Pasting a real ingredient list (or using the barcode scan
  feature) produces far better matches than a vague product name.
- **It's keyword-based, not NLP.** "Sweetened" won't match "sugar"; acrylamide needs the
  exact phrase "browned toast" or "burnt toast" (or the word "acrylamide" itself), not
  "dark toasted." See `TESTING.md` for verified examples of what does and doesn't match.
- **Concern levels are a coarse 1–3 heuristic**, not a regulatory or clinical rating.

## Roadmap

1. **Better text matching** — fuzzy/stemmed matching, or an LLM-assisted ingredient
   parser so users don't need exact label wording.
2. **Trend view** — score-over-time charts per category, and biomarker trend charts.
3. **Real sensor fusion** — a scheduled job polling a personal air-quality monitor's API
   (PurpleAir, Awair) into `air_quality_logs` automatically; smart-home triggers off the
   AQI classification. Sketched in `ADVANCED_TIER.md` §1; `sources/openfoodfacts_client.py`
   is the pattern to copy for a new client.
4. **Open Beauty Facts integration** — same barcode-scan pattern as food, for personal
   care products (coverage is currently much sparser than Open Food Facts, so this was
   deprioritized versus the food barcode scan).
5. **Multi-user support + auth** — only needed if this moves beyond a single local user.
6. **Clinical/professional handoff** — an exportable summary report framed as "patterns
   I've noticed," not a diagnosis.

## Project layout

```
app.py                      Flask routes
db.py                       SQLite storage layer (8 tables; see schema at top of file)
engine/scoring.py           Matching + fusion/scoring + Focus/Quick Wins ranking
engine/achievements.py      Gamification: badge catalog + streak
engine/aqi.py                EPA AQI classification for PM2.5/PM10
engine/produce.py           Produce diversity tally (informational, unscored)
sources/pubmed_client.py    Live PubMed citation fetcher
sources/pubchem_client.py   Live PubChem GHS/identity fetcher
sources/sync_db.py          Orchestrates the two above to refresh hazard_database.json
sources/openfoodfacts_client.py  Barcode → product/ingredients/NOVA lookup
data/hazard_database.json   34 curated + live-sourced substances
data/concepts.json          9-concept shared glossary (general + technical text each)
data/aqi_breakpoints.json   EPA-verified PM2.5/PM10 AQI breakpoints
data/produce_tiers.json     Produce diversity reference (USDA PDP pattern, original wording)
templates/                  Jinja2 pages
static/style.css            Styling
scripts/seed_demo_data.py       One-command realistic demo dataset
scripts/add_technical_notes.py  One-time patch: substance → concept_tags/technical_note mapping
tests/                      20 tests across scoring + achievements, no framework dependency
TESTING.md                  Manual test scenarios, each verified against the live engine
ADVANCED_TIER.md            Design doc: automation, wearables, lab-testing categories
```
