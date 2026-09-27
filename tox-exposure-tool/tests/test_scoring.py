import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from engine.scoring import score_logs, load_hazard_db  # noqa: E402

EMPTY_LOGS = {"food": [], "products": [], "environment": [], "air_quality": [], "practices": []}


def _logs(**overrides):
    d = dict(EMPTY_LOGS)
    d.update(overrides)
    return d


def test_hazard_db_loads():
    substances = load_hazard_db()
    assert len(substances) > 20
    ids = [s["id"] for s in substances]
    assert len(ids) == len(set(ids)), "duplicate substance ids"


def test_hazard_db_has_synced_references():
    substances = load_hazard_db()
    with_refs = [s for s in substances if s.get("references")]
    assert len(with_refs) >= 20, "expected most substances to carry synced PubMed references"
    sample = with_refs[0]
    ref = sample["references"][0]
    assert ref.get("pmid") and ref.get("url", "").startswith("https://pubmed.ncbi.nlm.nih.gov/")


def test_food_dye_and_sugar_flagged():
    logs = _logs(food=[
        {"food_item": "cereal with red 40 and added sugar", "meal": "breakfast", "notes": ""},
    ])
    report = score_logs(logs)
    flagged_ids = {s["id"] for s in report["category_summary"]["food"]["substances"]}
    assert "artificial_food_dyes" in flagged_ids
    assert "added_sugar" in flagged_ids
    assert report["overall_score"] > 0


def test_product_ingredient_list_matching():
    logs = _logs(products=[
        {
            "product_name": "Brand X Shampoo",
            "product_type": "Shampoo",
            "ingredients_text": "Water, Sodium Laureth Sulfate, Fragrance, DMDM Hydantoin",
            "notes": "",
        }
    ])
    report = score_logs(logs)
    flagged_ids = {s["id"] for s in report["category_summary"]["personal_care"]["substances"]}
    assert "sodium_lauryl_sulfate" in flagged_ids
    assert "phthalates" in flagged_ids  # via 'fragrance'
    assert "formaldehyde_releasers" in flagged_ids  # via 'dmdm hydantoin'


def test_environment_mold_flagged_high_concern():
    logs = _logs(environment=[
        {"location": "Home - bathroom", "condition_type": "Mold / musty smell",
         "detail": "musty smell under sink", "notes": ""}
    ])
    report = score_logs(logs)
    env = report["category_summary"]["environment"]
    assert env["score"] == 3
    assert any(r["source"] == "Indoor mold / mycotoxin exposure" for r in report["recommendations"])


def test_empty_logs_yield_minimal_band():
    report = score_logs(EMPTY_LOGS)
    assert report["overall_score"] == 0
    assert report["awareness_band"]["key"] == "minimal"
    assert report["focus_items"] == []


def test_ultra_processed_food_flagged_as_structural_not_substance():
    logs = _logs(food=[
        {"food_item": "toaster pastry", "meal": "breakfast", "notes": "", "processing_level": 4},
        {"food_item": "packaged snack cake", "meal": "snack", "notes": "", "processing_level": 4},
    ])
    report = score_logs(logs)
    assert report["processing_counts"].get(4) == 2
    assert report["category_summary"]["food"]["score"] >= 2
    assert any(r["tip_key"] == "processing:reduce_upf" for r in report["recommendations"])


def test_air_quality_moderate_reading_flows_into_environment_and_focus():
    logs = _logs(air_quality=[
        {"location": "Home", "pollutant": "PM2.5", "value": 40.0, "source": "AirNow", "notes": ""}
    ])
    report = score_logs(logs)
    assert len(report["air_quality_readings"]) == 1
    reading = report["air_quality_readings"][0]
    assert reading["category"] == "Unhealthy for Sensitive Groups"
    assert report["category_summary"]["environment"]["score"] > 0
    assert any(r["tip_key"].startswith("air_quality:") for r in report["recommendations"])


def test_air_quality_good_reading_does_not_inflate_score():
    logs = _logs(air_quality=[
        {"location": "Home", "pollutant": "PM2.5", "value": 4.0, "source": "AirNow", "notes": ""}
    ])
    report = score_logs(logs)
    assert report["air_quality_readings"][0]["category"] == "Good"
    assert report["overall_score"] == 0


def test_practices_tracked_separately_and_not_scored():
    logs = _logs(
        food=[{"food_item": "cereal with red 40", "meal": "breakfast", "notes": ""}],
        practices=[
            {"practice_type": "exercise", "duration_minutes": 30, "detail": "run", "notes": ""},
            {"practice_type": "fasting", "duration_minutes": 720, "detail": "", "notes": ""},
        ],
    )
    report = score_logs(logs)
    assert "exercise" in report["practice_summary"]
    assert report["practice_summary"]["exercise"]["count"] == 1
    assert report["practice_summary"]["fasting"]["total_minutes"] == 720
    # practices must never change the exposure score
    baseline = score_logs(_logs(food=logs["food"]))
    assert report["overall_score"] == baseline["overall_score"]


def test_produce_watch_list_diversity_tip():
    logs = _logs(food=[
        {"food_item": "strawberries", "meal": "breakfast", "notes": ""},
        {"food_item": "strawberries", "meal": "snack", "notes": ""},
        {"food_item": "spinach", "meal": "lunch", "notes": ""},
    ])
    report = score_logs(logs)
    assert report["produce_summary"]["watch_total"] == 3
    assert report["produce_summary"]["tip"] is not None
    # informational only — must not add to the numeric score
    assert report["overall_score"] == 0


def test_completed_actions_deprioritized_in_focus_but_not_hidden():
    logs = _logs(environment=[
        {"location": "Home - bathroom", "condition_type": "Mold / musty smell",
         "detail": "musty smell", "notes": ""}
    ])
    fresh = score_logs(logs)
    mold_tip_key = next(r["tip_key"] for r in fresh["recommendations"] if r["source"] == "Indoor mold / mycotoxin exposure")

    completed = score_logs(logs, completed_action_keys={mold_tip_key})
    matching = [r for r in completed["recommendations"] if r["tip_key"] == mold_tip_key]
    assert matching and matching[0]["completed"] is True
    # still present in the full recommendation list, just deprioritized in focus_items ordering
    focus_keys = [f["tip_key"] for f in completed["focus_items"]]
    all_keys = [r["tip_key"] for r in completed["recommendations"]]
    assert mold_tip_key in all_keys


def test_quick_wins_favors_low_effort_over_high_concern():
    """Quick Wins and This Week's Focus are deliberately different rankings: Focus is
    concern-first (mold, high concern + high effort, should dominate it), Quick Wins is
    effort-first (SLS, low concern + low effort, should dominate it instead)."""
    logs = _logs(
        products=[{
            "product_name": "Shampoo", "product_type": "Shampoo",
            "ingredients_text": "Water, Sodium Laureth Sulfate", "notes": "",
        }],
        environment=[{
            "location": "Home", "condition_type": "Mold / musty smell",
            "detail": "musty smell", "notes": "",
        }],
    )
    report = score_logs(logs)

    assert all(f["source"] == "Indoor mold / mycotoxin exposure" for f in report["focus_items"])
    assert all(q["action_effort"] == "low" for q in report["quick_wins"])
    assert all("Sodium Lauryl Sulfate" in q["source"] for q in report["quick_wins"])
    # mold's tips are all high-effort, so it must not appear in quick_wins at all
    assert not any("mold" in q["source"].lower() for q in report["quick_wins"])


def test_all_substances_carry_effort_and_impact_tags():
    substances = load_hazard_db()
    for s in substances:
        assert s.get("action_effort") in ("low", "medium", "high"), s["id"]
        assert s.get("action_impact") in ("low", "medium", "high"), s["id"]


def test_all_substances_have_technical_note_and_valid_concept_tags():
    from engine.scoring import load_concepts
    substances = load_hazard_db()
    concept_ids = set(load_concepts().keys())
    for s in substances:
        assert s.get("technical_note"), f"{s['id']} missing technical_note"
        tags = s.get("concept_tags") or []
        assert tags, f"{s['id']} has no concept_tags"
        for tag in tags:
            assert tag in concept_ids, f"{s['id']} references unknown concept_tag '{tag}'"


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
