"""
Populates exposure_log.db with a realistic week of DEMO data so the dashboard has
something to show immediately, without needing to hand-type entries for a week.

This is fabricated example data for exploring the app's features (UPF tracking,
produce diversity, AQI banding across categories, focus-item ranking, resilience
practices, logging streaks) — it is not a claim about anyone's real exposure.

Run:
    python3 -m scripts.seed_demo_data           # add demo data on top of whatever's there
    python3 -m scripts.seed_demo_data --reset    # wipe exposure_log.db first, then seed
"""
import argparse
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import db  # noqa: E402

TODAY = dt.date.today()


def d(days_ago):
    return (TODAY - dt.timedelta(days=days_ago)).isoformat()


def seed():
    db.init_db()

    # --- Food: mix of NOVA levels, a few flagged additives, repeated produce items
    #     to trigger the diversity tip ---
    food_entries = [
        (6, "breakfast", "plain oatmeal with banana and walnuts", 1, ""),
        (6, "snack", "strawberries", None, ""),
        (5, "breakfast", "packaged toaster pastry, orange juice", 4, "box said 'red 40' and 'BHA'"),
        (5, "snack", "strawberries", None, ""),
        (4, "breakfast", "scrambled eggs, dark toasted bagel", None, "toast came out pretty dark"),
        (4, "lunch", "bacon, sandwich, chips", None, "cured deli-style bacon"),
        (3, "breakfast", "sweetened cereal with red 40 and added sugar, whole milk", 4, ""),
        (3, "snack", "spinach smoothie with strawberries", None, ""),
        (2, "breakfast", "plain yogurt with fresh fruit", 1, ""),
        (2, "lunch", "canned soup, crackers", 4, ""),
        (1, "breakfast", "avocado toast, black coffee", None, "toast lightly golden"),
        (1, "snack", "coffee creamer with titanium dioxide", 4, "powdered creamer"),
        (0, "breakfast", "oats, blueberries, plain yogurt", 1, ""),
    ]
    for days_ago, meal, item, level, notes in food_entries:
        db.insert_food_log(d(days_ago), meal, item, processing_level=level, notes=notes)

    # --- Personal care: shampoo/conditioner with real-style ingredient lists ---
    product_entries = [
        (6, "Shampoo", "EverydayVolume Shampoo",
         "Water, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Fragrance, DMDM Hydantoin, Citric Acid", ""),
        (6, "Conditioner", "EverydayVolume Conditioner",
         "Water, Cetearyl Alcohol, Dimethicone, Fragrance, Methylparaben, Propylparaben", ""),
        (3, "Sunscreen", "DailyDefense SPF 30",
         "Homosalate, Octisalate, Retinyl Palmitate, Fragrance", "daily wear, not just beach days"),
        (2, "Deodorant", "FreshGuard Antiperspirant",
         "Aluminum Chlorohydrate, Fragrance, Cyclopentasiloxane", ""),
        (0, "Body wash", "Gentle Body Wash",
         "Water, Sodium Laureth Sulfate, Glycerin, Fragrance", "no irritation noticed"),
    ]
    for days_ago, ptype, name, ingredients, notes in product_entries:
        db.insert_product_log(d(days_ago), ptype, name, ingredients, notes)

    # --- Environment: mold + HVAC + VOC across home/work ---
    env_entries = [
        (5, "Home — bathroom", "Mold / musty smell", "musty smell under sink, never fully dried after a leak", ""),
        (4, "Home — bedroom", "HVAC / AC filter overdue", "filter hasn't been changed in ~6 months", ""),
        (2, "Workplace — office", "VOC (new paint/furniture/carpet smell)", "office got new carpet last week", "mild headache by end of day"),
        (0, "Home — basement", "High humidity", "condensation on the windows most mornings", ""),
    ]
    for days_ago, location, condition, detail, notes in env_entries:
        db.insert_environment_log(d(days_ago), location, condition, detail, notes)

    # --- Air quality: spans Good -> Moderate -> USG so the AQI banding is visible ---
    aq_entries = [
        (6, "Home", "PM2.5", 6.0, "AirNow", "clear day"),
        (4, "Home", "PM2.5", 18.5, "AirNow", "regional haze"),
        (2, "Home", "PM2.5", 40.0, "AirNow", "wildfire smoke drifting in"),
        (0, "Workplace", "PM2.5", 11.0, "workplace display", ""),
    ]
    for days_ago, location, pollutant, value, source, notes in aq_entries:
        db.insert_air_quality_log(d(days_ago), location, pollutant, value, source, notes)

    # --- Resilience practices: enough to populate the streak + practices table ---
    practice_entries = [
        (6, "exercise", 30, "morning run", ""),
        (5, "grounding_stretching", 10, "post-run stretch", ""),
        (4, "screen_free", 45, "phone-free dinner", ""),
        (3, "fasting", 720, "16:8 window", ""),
        (2, "exercise", 40, "strength training", ""),
        (1, "screen_free", 60, "evening walk, no phone", ""),
        (0, "grounding_stretching", 15, "morning stretch", ""),
    ]
    for days_ago, ptype, duration, detail, notes in practice_entries:
        db.insert_practice_log(d(days_ago), ptype, duration, detail, notes)

    print(f"Seeded {len(food_entries)} food, {len(product_entries)} product, "
          f"{len(env_entries)} environment, {len(aq_entries)} air-quality, "
          f"{len(practice_entries)} practice entries across the last 7 days.")
    print("Visit /dashboard to see the fused result, or /learn for the reference library.")


def reset():
    if db.DB_PATH.exists():
        db.DB_PATH.unlink()
        print(f"Removed {db.DB_PATH}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="Delete exposure_log.db before seeding")
    args = parser.parse_args()
    if args.reset:
        reset()
    seed()
