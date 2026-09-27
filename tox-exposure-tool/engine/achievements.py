"""
Gamification layer: streaks + a small achievement catalog, both designed around the
same non-fear-based principle as the scoring engine — every achievement rewards a
CONSTRUCTIVE behavior (logging consistently, taking action, diversifying produce,
resting/resetting), and none of them reward or punish having a low/high exposure score.
You cannot "lose points" here; there's no way for this system to make someone feel bad
about what they found when they logged something.
"""
import datetime as dt
from pathlib import Path

import db
from engine.scoring import load_hazard_db
from engine import produce as produce_engine

CATALOG = [
    {
        "key": "first_log",
        "name": "First Step",
        "icon": "\U0001F331",
        "description": "Logged your first entry.",
        "check": lambda s: s["total_all"] >= 1,
    },
    {
        "key": "streak_3",
        "name": "3-Day Streak",
        "icon": "\U0001F525",
        "description": "Logged something 3 days in a row.",
        "check": lambda s: s["streak"] >= 3,
    },
    {
        "key": "streak_7",
        "name": "Full Week",
        "icon": "\U0001F4C6",
        "description": "Logged something every day for a week.",
        "check": lambda s: s["streak"] >= 7,
    },
    {
        "key": "streak_30",
        "name": "30-Day Streak",
        "icon": "\U0001F3C6",
        "description": "A full month of consistent logging.",
        "check": lambda s: s["streak"] >= 30,
    },
    {
        "key": "full_picture",
        "name": "Full Picture",
        "icon": "\U0001F9E9",
        "description": "Logged all 5 categories at least once: food, personal care, environment, air quality, and a reset practice.",
        "check": lambda s: len(s["categories_logged"]) >= 5,
    },
    {
        "key": "focused_1",
        "name": "First Action",
        "icon": "✅",
        "description": "Marked a recommendation as done for the first time.",
        "check": lambda s: s["total_completed_actions"] >= 1,
    },
    {
        "key": "focused_10",
        "name": "Action Taker",
        "icon": "\U0001F4AA",
        "description": "Marked 10 recommendations as done.",
        "check": lambda s: s["total_completed_actions"] >= 10,
    },
    {
        "key": "quick_win_5",
        "name": "Low-Hanging Fruit",
        "icon": "\U0001F34E",
        "description": "Completed 5 low-effort Quick Win actions.",
        "check": lambda s: s["quick_wins_completed"] >= 5,
    },
    {
        "key": "produce_diversifier",
        "name": "Produce Diversifier",
        "icon": "\U0001F966",
        "description": "Logged 5 different lower-typical-residue produce items — variety in action.",
        "check": lambda s: s["distinct_lower_tier_produce"] >= 5,
    },
    {
        "key": "reset_regular",
        "name": "Reset Regular",
        "icon": "\U0001F9D8",
        "description": "Logged 10 resilience practices (fasting, exercise, screen-free time, stretching).",
        "check": lambda s: s["total_practices"] >= 10,
    },
    {
        "key": "air_aware",
        "name": "Air Aware",
        "icon": "\U0001F32C️",
        "description": "Logged 5 air quality readings.",
        "check": lambda s: s["total_air_quality"] >= 5,
    },
]


def compute_streak():
    dates = db.get_distinct_log_dates(days=60)
    if not dates:
        return 0
    dateset = set(dates)
    streak = 0
    cursor = dt.date.today()
    while cursor.isoformat() in dateset:
        streak += 1
        cursor -= dt.timedelta(days=1)
    return streak


def _quick_wins_completed(completed_tip_keys, substances_by_id):
    """A completed tip counts as a quick win if its source substance (or synthetic
    extra-tip category) is tagged low-effort. Mirrors engine/scoring.py's quick_wins logic
    but evaluated against the all-time completed_actions log rather than one window."""
    low_effort_synthetic_prefixes = ("produce:", "air_quality:")
    count = 0
    for key in completed_tip_keys:
        if key.startswith(low_effort_synthetic_prefixes):
            count += 1
            continue
        substance_id = key.split(":")[0]
        substance = substances_by_id.get(substance_id)
        if substance and substance.get("action_effort") == "low":
            count += 1
    return count


def compute_stats():
    raw = db.get_achievement_stats()
    substances_by_id = {s["id"]: s for s in load_hazard_db()}
    produce_summary = produce_engine.tally(raw["all_food_entries"])

    return {
        "total_all": (raw["total_food"] + raw["total_products"] + raw["total_environment"]
                      + raw["total_air_quality"] + raw["total_practices"]),
        "streak": compute_streak(),
        "categories_logged": raw["categories_logged"],
        "total_completed_actions": raw["total_completed_actions"],
        "quick_wins_completed": _quick_wins_completed(raw["completed_tip_keys"], substances_by_id),
        "distinct_lower_tier_produce": len(produce_summary["lower_hits"]),
        "total_practices": raw["total_practices"],
        "total_air_quality": raw["total_air_quality"],
    }


def evaluate_and_unlock():
    """Checks every achievement against current stats; persists any newly-met ones.
    Returns (all_unlocked_keys, newly_unlocked_list) so the caller can show a
    congratulations message only for achievements earned just now."""
    stats = compute_stats()
    already_unlocked = db.get_unlocked_achievement_keys()
    today = dt.date.today().isoformat()

    newly_unlocked = []
    for achievement in CATALOG:
        if achievement["key"] in already_unlocked:
            continue
        if achievement["check"](stats):
            db.unlock_achievement(achievement["key"], today)
            newly_unlocked.append(achievement)

    all_unlocked = already_unlocked | {a["key"] for a in newly_unlocked}
    return all_unlocked, newly_unlocked


def get_catalog_with_status():
    """Full catalog annotated with unlocked True/False, for the /achievements page."""
    unlocked = db.get_unlocked_achievement_keys()
    return [{**a, "unlocked": a["key"] in unlocked} for a in CATALOG]
