"""The editorial layer that "Simple" mode reads, and the copy of the database the app ships."""
import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).parent.parent
DB = json.loads((ROOT / "data" / "hazard_database.json").read_text())
APP_COPY = ROOT.parent / "exposure-awareness-mobile" / "src" / "data" / "hazardDatabase.json"


def test_every_substance_has_a_plain_summary():
    missing = [s["id"] for s in DB["substances"] if not s.get("summary_plain")]
    assert not missing, f"no summary_plain for: {missing}"


def test_plain_summaries_are_short_and_calm():
    for s in DB["substances"]:
        words = len(s["summary_plain"].split())
        assert 8 <= words <= 70, (s["id"], words)
        alarm = re.search(r"\b(toxic|toxin|toxins|deadly|dangerous|unsafe|lethal)\b", s["summary_plain"], re.I)
        assert not alarm, (s["id"], alarm and alarm.group(0))


@pytest.mark.skipif(not APP_COPY.exists(), reason="the app is not checked out next to this tool")
def test_the_app_ships_the_same_database():
    """The app bundles its own copy of the database; the two must never drift."""
    assert json.loads(APP_COPY.read_text()) == DB
