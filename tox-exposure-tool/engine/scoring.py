"""
Exposure fusion + scoring engine.

Treats each log category (food, personal_care products, environment, air quality,
resilience practices) as an independent "sensor stream". For each entry we match
free-text against the hazard database's names/aliases, classify numeric readings
(air quality) against EPA breakpoints, and fuse the results into a directional
awareness picture plus a short, ranked list of "this week's focus" actions.

Design intent (non-fear-based): the point is not to maximize a scary number. Awareness
bands use plain, non-alarming language; scores are directional/relative (which category
and which recurring items dominate YOUR logged pattern) rather than an absolute
toxicological risk measurement, and dose is not modeled. Resilience practices (fasting
windows, exercise, screen-free time, grounding/stretching) are tracked as their own
positive section, never mathematically netted against the exposure score — they support
general physiological/mental resilience, they don't "cancel out" logged chemical exposure,
and this tool doesn't claim otherwise.
"""
import json
from collections import defaultdict
from pathlib import Path

from engine import aqi as aqi_engine
from engine import produce as produce_engine

HAZARD_DB_PATH = Path(__file__).parent.parent / "data" / "hazard_database.json"

AWARENESS_BANDS = [
    (0, 2, "minimal", "Dialed In", "Nothing notable flagged in this window."),
    (2, 6, "low", "On Track", "A few things worth knowing about — nothing urgent."),
    (6, 12, "moderate", "Some Room to Improve", "A pattern worth addressing when it's convenient."),
    (12, 999, "priority", "Good Focus Area", "This is where your next change would matter most."),
]

NOVA_LABELS = {
    1: "Unprocessed / minimally processed",
    2: "Processed culinary ingredient",
    3: "Processed food",
    4: "Ultra-processed food",
}

GENERAL_TIPS = {
    "food": [
        "Favor whole, minimally-processed breakfast foods (eggs, oats, fresh fruit, plain yogurt) over packaged/ultra-processed ones.",
        "Rotate breakfast choices day-to-day rather than eating the identical processed product every morning, to avoid concentrating exposure to any single additive.",
    ],
    "personal_care": [
        "Simplify your routine: fewer, well-chosen products reduce the number of ingredient streams you're exposed to daily.",
        "Patch-test new products and give your skin/scalp days off from heavily fragranced items when possible.",
    ],
    "environment": [
        "Increase fresh-air ventilation where practical (exhaust fans, open windows) in the rooms you spend the most time in.",
        "Track recurring symptoms (headache, congestion, skin irritation) alongside location/time to help spot environmental patterns worth raising with facilities management or a physician.",
    ],
}

BEHAVIORAL_NOTE = (
    "If tracking exposures is driven by anxiety about health outcomes, or you notice the "
    "logging itself becoming stressful, that's worth mentioning to a therapist or counselor — "
    "behavioral strategies (e.g., CBT-based approaches to health anxiety) can help keep "
    "awareness useful rather than distressing."
)

RESILIENCE_NOTE = (
    "A note on 'detox': popular juice cleanses and similar products don't meaningfully speed "
    "up how your liver and kidneys clear chemicals — that's not something you need to do "
    "anything special to activate. What the practices below ARE well-supported for is general "
    "metabolic, cardiovascular, and mental resilience, and healthier day-to-day behavior "
    "patterns — which is a real and worthwhile goal on its own, just not literally a chemical "
    "'flush.' They're tracked separately from your exposure score for that reason."
)

PRACTICE_LABELS = {
    "fasting": "Fasting window",
    "exercise": "Exercise",
    "screen_free": "Screen-free / dopamine reset",
    "grounding_stretching": "Grounding / stretching",
    "other": "Other practice",
}

_IMPACT_RANK = {"high": 3, "medium": 2, "low": 1}


def load_hazard_db():
    with open(HAZARD_DB_PATH, "r") as f:
        data = json.load(f)
    return data["substances"]


def _text_blob(*parts):
    return " ".join(p for p in parts if p).lower()


def _match_substances(text, substances):
    # NOTE: plain substring matching, kept as the original prototype behaviour. The mobile engine
    # (exposure-awareness-mobile/src/engine/textMatch.ts) has since moved to whole-word matching
    # with plurals and negation, after a simulated soak run showed substring matching reading
    # "avocado" as the VOC alias, "BPA-free" as BPA and "bhaji" as BHA. This port has not.
    hits = []
    for s in substances:
        candidates = [s["name"]] + s.get("aliases", [])
        for c in candidates:
            if c.lower() in text:
                hits.append(s)
                break
    return hits


def _awareness_band(score):
    for lo, hi, key, label, description in AWARENESS_BANDS:
        if lo <= score < hi:
            return {"key": key, "label": label, "description": description}
    lo, hi, key, label, description = AWARENESS_BANDS[-1]
    return {"key": key, "label": label, "description": description}


def score_logs(logs, substances=None, completed_action_keys=None):
    """
    logs: dict with 'food', 'products', 'environment', 'air_quality', 'practices' lists
          (as returned by db.get_logs_for_range)
    completed_action_keys: set of tip_key strings the user has already marked done
          recently (from db.get_completed_action_keys) — deprioritized in focus_items,
          not hidden, since a tip can be worth repeating.
    Returns a fused analysis report.
    """
    if substances is None:
        substances = load_hazard_db()
    completed_action_keys = completed_action_keys or set()

    category_hits = defaultdict(list)
    entry_flags = {"food": [], "products": [], "environment": []}

    for entry in logs.get("food", []):
        text = _text_blob(entry.get("food_item"), entry.get("meal"), entry.get("notes"))
        matched = _match_substances(text, substances)
        if matched:
            entry_flags["food"].append({"entry": entry, "matches": [m["id"] for m in matched]})
        for m in matched:
            category_hits[m["category"]].append((m, entry, "food"))

    for entry in logs.get("products", []):
        text = _text_blob(entry.get("product_name"), entry.get("product_type"),
                           entry.get("ingredients_text"), entry.get("notes"))
        matched = _match_substances(text, substances)
        if matched:
            entry_flags["products"].append({"entry": entry, "matches": [m["id"] for m in matched]})
        for m in matched:
            category_hits[m["category"]].append((m, entry, "products"))

    for entry in logs.get("environment", []):
        text = _text_blob(entry.get("condition_type"), entry.get("location"),
                           entry.get("detail"), entry.get("notes"))
        matched = _match_substances(text, substances)
        if matched:
            entry_flags["environment"].append({"entry": entry, "matches": [m["id"] for m in matched]})
        for m in matched:
            category_hits[m["category"]].append((m, entry, "environment"))

    # --- Air quality (numeric, classified via EPA breakpoints, folded into environment) ---
    air_quality_readings = []
    air_quality_score = 0
    for entry in logs.get("air_quality", []):
        result = aqi_engine.classify(entry["pollutant"], entry["value"])
        if result:
            reading = {**entry, **result}
            air_quality_readings.append(reading)
            # only Moderate-and-up contributes to the score; "Good" days are noise, not signal
            if result["concern_level"] >= 1:
                air_quality_score += result["concern_level"]

    # --- NOVA / ultra-processed food tracking (structural, not a substance match) ---
    processing_counts = defaultdict(int)
    for entry in logs.get("food", []):
        level = entry.get("processing_level")
        if level:
            processing_counts[level] += 1
    upf_score = min(6, processing_counts.get(4, 0))  # capped contribution to food score

    # --- Produce diversity (informational only, does not affect score) ---
    produce_summary = produce_engine.tally(logs.get("food", []))

    # --- Resilience practices (tracked separately, never netted against the score) ---
    practice_summary = defaultdict(lambda: {"count": 0, "total_minutes": 0})
    for entry in logs.get("practices", []):
        pt = entry.get("practice_type", "other")
        practice_summary[pt]["count"] += 1
        practice_summary[pt]["total_minutes"] += entry.get("duration_minutes") or 0

    # --- Aggregate category scores ---
    category_summary = {}
    all_flagged_substances = {}
    for category, hits in category_hits.items():
        score = sum(s["concern_level"] for s, _, _ in hits)
        substance_counts = defaultdict(int)
        for s, _, _ in hits:
            substance_counts[s["id"]] += 1
            all_flagged_substances[s["id"]] = s
        category_summary[category] = {
            "score": score,
            "hit_count": len(hits),
            "substances": [
                {"id": sid, "name": all_flagged_substances[sid]["name"], "count": cnt,
                 "concern_level": all_flagged_substances[sid]["concern_level"]}
                for sid, cnt in sorted(substance_counts.items(), key=lambda kv: -kv[1])
            ],
        }
    category_summary.setdefault("food", {"score": 0, "hit_count": 0, "substances": []})
    category_summary.setdefault("environment", {"score": 0, "hit_count": 0, "substances": []})
    category_summary["food"]["score"] += upf_score
    category_summary["environment"]["score"] += air_quality_score

    overall_score = sum(c["score"] for c in category_summary.values())
    band = _awareness_band(overall_score)

    # --- Recommendations (substance-specific, ranked by concern) ---
    recommendations = []
    seen_tips = set()
    ranked_substances = sorted(all_flagged_substances.values(), key=lambda s: -s["concern_level"])
    for s in ranked_substances:
        for i, tip in enumerate(s.get("mitigation_tips", [])):
            if tip not in seen_tips:
                tip_key = f"{s['id']}:{i}"
                count = next((c["count"] for c in category_summary.get(s["category"], {}).get("substances", [])
                              if c["id"] == s["id"]), 1)
                recommendations.append({
                    "tip_key": tip_key,
                    "source": s["name"],
                    "tip": tip,
                    "concern_level": s["concern_level"],
                    "weight": s["concern_level"] * count,
                    "completed": tip_key in completed_action_keys,
                    "action_effort": s.get("action_effort", "medium"),
                    "action_impact": s.get("action_impact", "medium"),
                })
                seen_tips.add(tip)

    # UPF + produce + air-quality tips feed into the same focus pool with their own tip_keys
    extra_tips = []
    if upf_score >= 2:
        extra_tips.append({
            "tip_key": "processing:reduce_upf",
            "source": "Ultra-processed food pattern",
            "tip": ("You've logged multiple ultra-processed items this week. Swapping just one "
                    "for a minimally-processed alternative (e.g. plain oats + fruit instead of a "
                    "packaged pastry) is one of the higher-leverage changes available — it "
                    "reduces many additives at once rather than targeting a single ingredient."),
            "concern_level": 2,
            "weight": upf_score,
            "completed": "processing:reduce_upf" in completed_action_keys,
            "action_effort": "medium",
            "action_impact": "medium",
        })
    if produce_summary["tip"]:
        extra_tips.append({
            "tip_key": "produce:diversify",
            "source": "Produce variety",
            "tip": produce_summary["tip"],
            "concern_level": 1,
            "weight": produce_summary["watch_total"],
            "completed": "produce:diversify" in completed_action_keys,
            "action_effort": "low",
            "action_impact": "low",
        })
    for reading in air_quality_readings:
        if reading["concern_level"] >= 2:
            key = f"air_quality:{reading['pollutant']}:{reading['category']}"
            extra_tips.append({
                "tip_key": key,
                "source": f"Air quality ({reading['location']})",
                "tip": f"{reading['category']} {reading['pollutant']} reading logged ({reading['value']} µg/m³). {reading['guidance']}",
                "concern_level": reading["concern_level"],
                "weight": reading["concern_level"] * 2,
                "completed": key in completed_action_keys,
                "action_effort": "low",
                "action_impact": "high" if reading["concern_level"] >= 3 else "medium",
            })

    recommendations.extend(extra_tips)
    recommendations.sort(key=lambda r: -r["concern_level"])

    # This Week's Focus: top 3 by weight, incomplete ones prioritized over completed repeats
    focus_pool = sorted(recommendations, key=lambda r: (r["completed"], -r["weight"]))
    focus_items = focus_pool[:3]

    # Quick Wins: low-effort actions regardless of concern level — the behavior-change
    # lever. A "priority focus" item and a "quick win" can be the same tip, or not; this
    # section exists because concern-ranked and effort-ranked are genuinely different
    # questions ("what matters most" vs "what's easiest to just go do right now").
    quick_win_pool = [r for r in recommendations if r.get("action_effort") == "low"]
    quick_win_pool.sort(key=lambda r: (r["completed"], -_IMPACT_RANK.get(r.get("action_impact"), 2), -r["weight"]))
    quick_wins = quick_win_pool[:3]

    general_recs = []
    for category, tips in GENERAL_TIPS.items():
        cat_score = category_summary.get(category, {}).get("score", 0)
        if cat_score >= 2:
            for tip in tips:
                general_recs.append({"source": f"general/{category}", "tip": tip})

    return {
        "overall_score": overall_score,
        "awareness_band": band,
        "category_summary": category_summary,
        "entry_flags": entry_flags,
        "recommendations": recommendations,
        "focus_items": focus_items,
        "quick_wins": quick_wins,
        "general_recommendations": general_recs,
        "behavioral_note": BEHAVIORAL_NOTE,
        "resilience_note": RESILIENCE_NOTE,
        "air_quality_readings": air_quality_readings,
        "processing_counts": dict(processing_counts),
        "produce_summary": produce_summary,
        "practice_summary": {k: dict(v) for k, v in practice_summary.items()},
        "entries_analyzed": {
            "food": len(logs.get("food", [])),
            "products": len(logs.get("products", [])),
            "environment": len(logs.get("environment", [])),
            "air_quality": len(logs.get("air_quality", [])),
            "practices": len(logs.get("practices", [])),
        },
    }


CONCEPTS_PATH = Path(__file__).parent.parent / "data" / "concepts.json"


def load_concepts():
    with open(CONCEPTS_PATH, "r") as f:
        data = json.load(f)
    return {c["id"]: c for c in data["concepts"]}
