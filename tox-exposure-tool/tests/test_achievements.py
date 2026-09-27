"""Achievements engine tests. Uses a temporary SQLite file (via db.DB_PATH monkeypatch)
so these tests never touch the real exposure_log.db a developer might have open."""
import datetime as dt
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import db  # noqa: E402
from engine import achievements  # noqa: E402


def _fresh_db():
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    db.DB_PATH = Path(tmp.name)
    db.init_db()
    return db.DB_PATH


def _cleanup(path):
    path.unlink(missing_ok=True)


def test_first_log_unlocks_on_first_entry():
    path = _fresh_db()
    try:
        stats_before = achievements.compute_stats()
        assert stats_before["total_all"] == 0

        db.insert_food_log(dt.date.today().isoformat(), "breakfast", "oats", notes="")
        all_unlocked, newly = achievements.evaluate_and_unlock()

        assert "first_log" in all_unlocked
        assert any(a["key"] == "first_log" for a in newly)
    finally:
        _cleanup(path)


def test_achievement_does_not_unlock_twice():
    path = _fresh_db()
    try:
        db.insert_food_log(dt.date.today().isoformat(), "breakfast", "oats", notes="")
        _, first_pass = achievements.evaluate_and_unlock()
        _, second_pass = achievements.evaluate_and_unlock()

        assert any(a["key"] == "first_log" for a in first_pass)
        assert not any(a["key"] == "first_log" for a in second_pass), \
            "already-unlocked achievement should not fire again"
    finally:
        _cleanup(path)


def test_full_picture_requires_all_five_categories():
    path = _fresh_db()
    try:
        today = dt.date.today().isoformat()
        db.insert_food_log(today, "breakfast", "oats", notes="")
        db.insert_product_log(today, "Shampoo", "Brand X", "", "")
        db.insert_environment_log(today, "Home", "Mold", "", "")
        db.insert_air_quality_log(today, "Home", "PM2.5", 5.0, "AirNow", "")

        all_unlocked, _ = achievements.evaluate_and_unlock()
        assert "full_picture" not in all_unlocked, "only 4 of 5 categories logged so far"

        db.insert_practice_log(today, "exercise", 30, "", "")
        all_unlocked, _ = achievements.evaluate_and_unlock()
        assert "full_picture" in all_unlocked
    finally:
        _cleanup(path)


def test_streak_achievements_require_consecutive_days():
    path = _fresh_db()
    try:
        today = dt.date.today()
        for offset in range(3):
            d = (today - dt.timedelta(days=offset)).isoformat()
            db.insert_food_log(d, "breakfast", "oats", notes="")

        all_unlocked, _ = achievements.evaluate_and_unlock()
        assert "streak_3" in all_unlocked
        assert "streak_7" not in all_unlocked
    finally:
        _cleanup(path)


def test_no_achievement_rewards_a_high_or_low_exposure_score():
    """Design invariant: the catalog must never reference exposure score / risk band /
    concern_level — gamification should never punish or reward what was found."""
    for a in achievements.CATALOG:
        # a crude but effective guard: achievement descriptions/keys shouldn't reference
        # scoring vocabulary at all
        text = (a["key"] + " " + a["description"]).lower()
        for forbidden in ("score", "risk", "concern", "band", "flagged"):
            assert forbidden not in text, f"{a['key']} description references '{forbidden}'"


if __name__ == "__main__":
    import traceback
    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"PASS {t.__name__}")
        except Exception:
            failed += 1
            print(f"FAIL {t.__name__}")
            traceback.print_exc()
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
