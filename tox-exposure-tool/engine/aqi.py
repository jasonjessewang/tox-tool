"""EPA AQI classification for PM2.5 / PM10 readings. See data/aqi_breakpoints.json for
the breakpoint table and its source citation."""
import json
from pathlib import Path

AQI_PATH = Path(__file__).parent.parent / "data" / "aqi_breakpoints.json"

_cache = None


def _load():
    global _cache
    if _cache is None:
        with open(AQI_PATH) as f:
            _cache = json.load(f)
    return _cache


def _pollutant_key(pollutant):
    p = pollutant.strip().lower().replace(" ", "").replace("_", "")
    if p in ("pm25", "pm2.5"):
        return "pm25"
    if p in ("pm10",):
        return "pm10"
    return None


def classify(pollutant, value):
    """Return {category, aqi_estimate, color, guidance, concern_level} for a reading,
    or None if the pollutant isn't recognized. concern_level (0-5) mirrors the hazard
    database's 1-3 scale but extended, for blending into the environment category score."""
    data = _load()
    key = _pollutant_key(pollutant)
    if key is None:
        return None
    table = data[key]
    for row in table:
        if row["lo"] <= value <= row["hi"]:
            # linear-interpolate the AQI index within this breakpoint band (standard EPA formula)
            span_val = row["hi"] - row["lo"]
            span_aqi = row["aqi_hi"] - row["aqi_lo"]
            aqi_estimate = row["aqi_lo"] if span_val == 0 else round(
                row["aqi_lo"] + (value - row["lo"]) * span_aqi / span_val
            )
            concern_level = min(5, table.index(row))
            return {
                "category": row["category"],
                "aqi_estimate": aqi_estimate,
                "color": row["color"],
                "guidance": row["guidance"],
                "concern_level": concern_level,
            }
    # above the top breakpoint
    last = table[-1]
    return {
        "category": last["category"],
        "aqi_estimate": last["aqi_hi"],
        "color": last["color"],
        "guidance": last["guidance"],
        "concern_level": 5,
    }
