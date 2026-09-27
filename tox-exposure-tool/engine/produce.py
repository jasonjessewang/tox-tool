"""Aggregate-exposure awareness for produce, per data/produce_tiers.json.

Deliberately does NOT feed the numeric exposure score — pesticide residue variety is
about diversification, not a 'flag' like a specific additive. See _meta.principle in the
data file: what matters is not eating the same few watch-list items exclusively, not
avoiding any single food."""
import json
from pathlib import Path

TIERS_PATH = Path(__file__).parent.parent / "data" / "produce_tiers.json"

_cache = None


def _load():
    global _cache
    if _cache is None:
        with open(TIERS_PATH) as f:
            _cache = json.load(f)
    return _cache


def tally(food_entries):
    """Given food log entries, count mentions of watch-list vs lower-typical produce
    items and return a summary dict with a diversification tip when skewed."""
    data = _load()
    watch = {i["item"]: i["note"] for i in data["watch_list"]}
    lower = {i["item"]: i["note"] for i in data["lower_typical"]}

    watch_hits = {}
    lower_hits = {}
    for entry in food_entries:
        text = " ".join(str(entry.get(k, "") or "") for k in ("food_item", "notes")).lower()
        for item in watch:
            if item.split("/")[0].split(" & ")[0] in text or item in text:
                watch_hits[item] = watch_hits.get(item, 0) + 1
        for item in lower:
            if item in text:
                lower_hits[item] = lower_hits.get(item, 0) + 1

    watch_total = sum(watch_hits.values())
    lower_total = sum(lower_hits.values())
    total = watch_total + lower_total

    tip = None
    if total >= 3 and watch_total / total >= 0.7:
        distinct_watch = len(watch_hits)
        if distinct_watch <= 2:
            tip = (
                f"Your logged produce leans heavily on {', '.join(watch_hits)} specifically. "
                "Rotating in a wider variety (including some lower-tier items like avocado, "
                "banana, cabbage, or citrus) is a simple way to avoid concentrating exposure "
                "to any one item's typical residue profile — not a reason to cut what you're eating now."
            )
        else:
            tip = (
                "Several of your produce picks this week are from the historically "
                "higher-residue-detection group. A quick produce-wash soak (not just a rinse) "
                "for these items, or occasionally swapping in a lower-typical item, are both "
                "low-effort ways to broaden your aggregate exposure profile."
            )

    return {
        "watch_hits": watch_hits,
        "lower_hits": lower_hits,
        "watch_total": watch_total,
        "lower_total": lower_total,
        "tip": tip,
    }
