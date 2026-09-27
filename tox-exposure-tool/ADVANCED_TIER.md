# Advanced Tier: For Users With More Resources to Deploy

The core app is deliberately complete without any of this — logging, the fused
dashboard, Quick Wins, Learn, and achievements all work with nothing but a few minutes a
day and a free-text box. This document is about a different question: **if someone has
disposable income, what's actually worth spending it on to act on what this tool
surfaces, and how would it plug back into the same app?**

None of this is built as a paywall or a subscription tier inside the app — there isn't
one, and this project doesn't need one. It's a map of the real, mostly-free-standing
tools and services that exist, organized by the same three streams (diet, personal care,
environment) plus a new one this section introduces: **biomarkers**, i.e. measuring the
body's own signal rather than inferring exposure from logged inputs. The `biomarker_logs`
table and `/log/biomarker` route already built into the app exist specifically so this
data has somewhere to live alongside everything else, instead of sitting in five
different apps that never talk to each other.

**A caution that applies to all of it:** more testing and more automation are not
automatically better. Over-testing without a clinical reason has real costs — false
positives, incidentalomas, and the anxiety loop this app's own `behavioral_note` already
warns about. Everything below is framed as "this category exists," not "you should do
this." A physician, not this document, is the right place to decide what's worth doing
for a specific person.

---

## 1. Automating the awareness loop (low-to-no cost, mostly software)

These make the *existing* free app more automatic — the highest-leverage spend is often
none at all:

- **Barcode/product lookup** — already built (`/log/food/scan`, via the free Open Food
  Facts API). The natural next step if budget allows: a dedicated barcode scanner
  ($20–40) instead of typing digits, for someone logging many packaged items.
- **Continuous air quality monitoring** — a $250–300 indoor/outdoor sensor (e.g. the
  PurpleAir network, or similar consumer IAQ monitors) exposes a JSON API. A small script
  polling that API and calling `db.insert_air_quality_log()` on a schedule turns "Log Air
  Quality" from a manual chore into a background stream — this is a natural open-source
  contribution to this project if someone wants to build it (`sources/` already has the
  client pattern to copy from `openfoodfacts_client.py`).
- **Smart-home triggers** — a AQI reading crossing into "Unhealthy for Sensitive Groups"
  (this app's own `engine/aqi.py` classification) could trigger a smart plug turning on a
  HEPA purifier via Home Assistant/IFTTT. The classification logic already exists in this
  codebase; wiring it to a webhook is a small addition.
- **Grocery delivery pre-filtering** — several grocery delivery services and browser
  extensions (e.g. Yuka, EWG Healthy Living/Food Scores) let you filter or score products
  by additive/processing level before buying, which front-loads the "choose differently"
  step this app currently surfaces only after the fact via Quick Wins.
- **Water filtration + testing** — a whole-house or under-sink filter (NSF/ANSI 53
  certified for the specific contaminant of concern — lead, PFAS, or THMs are different
  certifications) paired with an annual water test (many U.S. municipal utilities publish
  a free Consumer Confidence Report; private wells need paid testing, often $50–150) is
  the single highest-leverage environment-category spend for households on well water or
  older plumbing (see the `lead_exposure` and `chlorination_byproducts` Learn entries).
- **Radon mitigation** — the test kit is $15–25 (already the top tip in the `radon`
  Learn entry); if it comes back elevated, professional sub-slab depressurization
  installation is typically $800–2,500 depending on the market and is one of the few
  interventions here with a well-established, large effect size (EPA/Surgeon General
  data on radon and lung cancer risk).

## 2. Wearables — objective feedback on the resilience-practices loop

The app's Resilience Practices section (fasting, exercise, screen-free time, stretching)
is currently self-reported duration only. A wearable turns it into a feedback loop:

- **Sleep + HRV trackers** (Oura, Whoop, Apple Watch, Garmin) — log the daily HRV or
  sleep score into `/log/biomarker` alongside a practice entry, and over weeks/months you
  can eyeball whether the practices you're actually doing (not just intending to do)
  track with the recovery metrics you care about. This app does not compute that
  correlation for you — that's a deliberate choice, both because a coarse
  visual/spreadsheet check is more honest about uncertainty than a fake "correlation
  score," and because this is a case where a data/sensor fusion claim beyond simple
  side-by-side logging would need real statistical rigor this tool doesn't attempt.
- **Continuous glucose monitor (CGM)** — available over-the-counter in the U.S. without
  a prescription as of the 2020s (e.g. Abbott Libre, Dexcom Stelo), typically
  $50–80/month. This is the most direct possible link back to the Food logging stream:
  log a breakfast, see the glucose response, and the NOVA/UPF pattern this app already
  tracks becomes something you can literally watch play out rather than take on faith.
- **Grip strength dynamometer** ($25–40) — grip strength is one of the more
  well-replicated simple longevity/functional-health markers in the literature. A 10-second
  test, worth logging quarterly.
- **VO2max** — estimated for free by most wearables (Apple Watch, Garmin, Whoop) from
  normal workout data, or measured directly in a lab/exercise physiology test ($100–250,
  more precise). Either way, log it to `/log/biomarker` as a trend, not a one-time number.
- **Body composition (DEXA scan)** — $50–150 out of pocket at most imaging centers or
  sports-medicine clinics in the U.S., no prescription typically needed. More precise
  than a bathroom scale for tracking body composition change over a UPF-reduction or
  exercise-consistency period.
- **30-second sit-to-stand test** — free, no equipment: count how many times you can
  stand up from a chair and sit back down in 30 seconds. A validated basic mobility/frailty
  screen used in geriatric and physical-therapy settings; worth a quarterly log entry for
  anyone who doesn't want to buy anything.

## 3. Periodic lab testing — categories that exist, not a personal recommendation

These are describable market categories, offered by hospital lab-draw services,
direct-to-consumer lab companies, and some functional-medicine practices. Whether any of
them make sense for a given person is a conversation with a physician, not something this
document or app decides. Cadence guidance below (e.g. "quarterly") reflects common
industry marketing around these panels, not a clinical guideline this project is
asserting — many of these markers do not need to be checked that often for someone
without a specific indication, and your own clinician's judgment should override anything
here.

**Blood:**
- Standard metabolic panel, lipid panel, HbA1c — routine, usually annual, ordered by a
  primary care physician as part of normal care rather than a "toxicology" panel.
- hs-CRP (inflammation marker) — sometimes included in expanded panels; relevant if
  tracking whether dietary/environmental changes correlate with a general inflammation
  trend, with the same caveat as the wearable-correlation note above.
- Heavy metals panel (blood lead, mercury) — more targeted; relevant if this app's own
  `lead_exposure` entry is flagged for your household (old plumbing/paint) or you have
  occupational exposure, rather than as a routine screen for everyone.
- PFAS serum testing — newly available from some specialty/reference labs as of the
  mid-2020s given rising PFAS awareness (see this app's `pfas_packaging` entry); still a
  niche, not-yet-routine test, and interpretation guidance is still evolving even among
  specialists.

**Urine:**
- Urinary phthalate/BPA metabolite panels — the same biomarkers used in NHANES-style
  population research are available from a handful of specialty/environmental-health labs
  directly to consumers. Useful mainly as a personal before/after check around a
  product-swap intervention (e.g. after acting on this app's `phthalates` Quick Win) if
  someone specifically wants objective confirmation, not as routine monitoring.

**Stool:**
- Microbiome composition testing — consumer options exist (research-grade sequencing at
  lower cost than a decade ago); interpretability of any single consumer report against
  actionable diet changes is still a genuinely unsettled area of the science, more so than
  most other categories here.
- Fecal calprotectin (GI inflammation marker) — more clinically established, relevant if
  there's a specific GI symptom pattern rather than as a general wellness check.

**Suggested cadence, if a clinician agrees testing makes sense at all:** a baseline, then
re-check on whatever interval the specific marker's natural variability and your
intervention timeline justify — quarterly is common in DTC marketing but overkill for
markers that don't meaningfully change that fast (e.g. body composition, most metabolic
markers); it can make sense for something you're actively intervening on with a
fast-feedback loop (e.g. a CGM-tracked dietary change). This is exactly the kind of
one-size-fits-all cadence question that's better answered by a clinician who knows the
specific person than by a fixed number in a document.

## 4. Equity note

Nothing in this document is required to use the app well. The single highest-leverage
actions surfaced by the core tool — shoes off at the door, fragrance-free detergent,
range hood while cooking, a $15 radon test kit, walking instead of scrolling — are
already the cheapest tier and remain the main point. This section exists because the user
who *can* spend more asked a fair question (what would I actually buy?), not because
spending more is what makes the awareness loop work.
