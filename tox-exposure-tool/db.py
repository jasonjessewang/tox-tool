"""SQLite storage for exposure logs. Single-user local tool; no auth."""
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).parent / "exposure_log.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS food_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_date TEXT NOT NULL,
    meal TEXT NOT NULL,
    food_item TEXT NOT NULL,
    processing_level INTEGER,  -- NOVA 1-4, nullable (1=unprocessed .. 4=ultra-processed)
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_date TEXT NOT NULL,
    product_type TEXT NOT NULL,
    product_name TEXT NOT NULL,
    ingredients_text TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS environment_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_date TEXT NOT NULL,
    location TEXT NOT NULL,
    condition_type TEXT NOT NULL,
    detail TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS air_quality_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_date TEXT NOT NULL,
    location TEXT NOT NULL,
    pollutant TEXT NOT NULL,      -- 'PM2.5' or 'PM10'
    value REAL NOT NULL,          -- micrograms per cubic meter
    source TEXT,                  -- e.g. 'AirNow', 'personal monitor', 'estimate'
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS practice_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_date TEXT NOT NULL,
    practice_type TEXT NOT NULL,  -- fasting | exercise | screen_free | grounding_stretching | other
    duration_minutes INTEGER,
    detail TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS completed_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tip_key TEXT NOT NULL,        -- stable id for the recommendation, e.g. substance id + tip index
    tip_text TEXT NOT NULL,
    completed_date TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    achievement_key TEXT NOT NULL UNIQUE,
    unlocked_date TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS biomarker_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_date TEXT NOT NULL,
    metric TEXT NOT NULL,         -- e.g. 'HRV', 'resting_heart_rate', 'grip_strength', 'hba1c'
    value REAL NOT NULL,
    unit TEXT,
    source TEXT,                  -- e.g. 'Oura', 'lab: Quest', 'home test', 'gym'
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
"""


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        _migrate(conn)


def _migrate(conn):
    """Lightweight migration for columns added after initial release, so an existing
    exposure_log.db from an earlier version of the app doesn't need to be deleted."""
    cols = {row["name"] for row in conn.execute("PRAGMA table_info(food_logs)")}
    if "processing_level" not in cols:
        conn.execute("ALTER TABLE food_logs ADD COLUMN processing_level INTEGER")


def insert_food_log(log_date, meal, food_item, processing_level=None, notes=""):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO food_logs (log_date, meal, food_item, processing_level, notes) "
            "VALUES (?, ?, ?, ?, ?)",
            (log_date, meal, food_item, processing_level, notes),
        )


def insert_product_log(log_date, product_type, product_name, ingredients_text, notes=""):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO product_logs (log_date, product_type, product_name, ingredients_text, notes) "
            "VALUES (?, ?, ?, ?, ?)",
            (log_date, product_type, product_name, ingredients_text, notes),
        )


def insert_environment_log(log_date, location, condition_type, detail, notes=""):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO environment_logs (log_date, location, condition_type, detail, notes) "
            "VALUES (?, ?, ?, ?, ?)",
            (log_date, location, condition_type, detail, notes),
        )


def insert_air_quality_log(log_date, location, pollutant, value, source="", notes=""):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO air_quality_logs (log_date, location, pollutant, value, source, notes) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (log_date, location, pollutant, value, source, notes),
        )


def insert_practice_log(log_date, practice_type, duration_minutes, detail="", notes=""):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO practice_logs (log_date, practice_type, duration_minutes, detail, notes) "
            "VALUES (?, ?, ?, ?, ?)",
            (log_date, practice_type, duration_minutes, detail, notes),
        )


def mark_action_completed(tip_key, tip_text, completed_date):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO completed_actions (tip_key, tip_text, completed_date) VALUES (?, ?, ?)",
            (tip_key, tip_text, completed_date),
        )


def get_completed_action_keys(since_date=None):
    with get_conn() as conn:
        if since_date:
            rows = conn.execute(
                "SELECT DISTINCT tip_key FROM completed_actions WHERE completed_date >= ?", (since_date,)
            ).fetchall()
        else:
            rows = conn.execute("SELECT DISTINCT tip_key FROM completed_actions").fetchall()
    return {r["tip_key"] for r in rows}


def get_logs_for_range(start_date, end_date):
    with get_conn() as conn:
        food = conn.execute(
            "SELECT * FROM food_logs WHERE log_date BETWEEN ? AND ? ORDER BY log_date DESC",
            (start_date, end_date),
        ).fetchall()
        products = conn.execute(
            "SELECT * FROM product_logs WHERE log_date BETWEEN ? AND ? ORDER BY log_date DESC",
            (start_date, end_date),
        ).fetchall()
        environment = conn.execute(
            "SELECT * FROM environment_logs WHERE log_date BETWEEN ? AND ? ORDER BY log_date DESC",
            (start_date, end_date),
        ).fetchall()
        air_quality = conn.execute(
            "SELECT * FROM air_quality_logs WHERE log_date BETWEEN ? AND ? ORDER BY log_date DESC",
            (start_date, end_date),
        ).fetchall()
        practices = conn.execute(
            "SELECT * FROM practice_logs WHERE log_date BETWEEN ? AND ? ORDER BY log_date DESC",
            (start_date, end_date),
        ).fetchall()
    return {
        "food": [dict(r) for r in food],
        "products": [dict(r) for r in products],
        "environment": [dict(r) for r in environment],
        "air_quality": [dict(r) for r in air_quality],
        "practices": [dict(r) for r in practices],
    }


def get_recent_logs(limit=15):
    with get_conn() as conn:
        food = conn.execute(
            "SELECT * FROM food_logs ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
        products = conn.execute(
            "SELECT * FROM product_logs ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
        environment = conn.execute(
            "SELECT * FROM environment_logs ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
        air_quality = conn.execute(
            "SELECT * FROM air_quality_logs ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
        practices = conn.execute(
            "SELECT * FROM practice_logs ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return {
        "food": [dict(r) for r in food],
        "products": [dict(r) for r in products],
        "environment": [dict(r) for r in environment],
        "air_quality": [dict(r) for r in air_quality],
        "practices": [dict(r) for r in practices],
    }


def get_distinct_log_dates(days=60):
    """All dates (any category) with at least one entry, most recent first — powers the
    logging streak on the dashboard."""
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT log_date FROM (
                SELECT log_date FROM food_logs
                UNION SELECT log_date FROM product_logs
                UNION SELECT log_date FROM environment_logs
                UNION SELECT log_date FROM air_quality_logs
                UNION SELECT log_date FROM practice_logs
            ) ORDER BY log_date DESC LIMIT ?
        """, (days,)).fetchall()
    return [r["log_date"] for r in rows]


def delete_log(category, log_id):
    table = {
        "food": "food_logs",
        "products": "product_logs",
        "environment": "environment_logs",
        "air_quality": "air_quality_logs",
        "practices": "practice_logs",
        "biomarkers": "biomarker_logs",
    }[category]
    with get_conn() as conn:
        conn.execute(f"DELETE FROM {table} WHERE id = ?", (log_id,))


def insert_biomarker_log(log_date, metric, value, unit="", source="", notes=""):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO biomarker_logs (log_date, metric, value, unit, source, notes) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (log_date, metric, value, unit, source, notes),
        )


def get_biomarker_logs(limit=200):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM biomarker_logs ORDER BY log_date DESC, created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in rows]


# --- Achievements ---

def get_unlocked_achievement_keys():
    with get_conn() as conn:
        rows = conn.execute("SELECT achievement_key FROM achievements").fetchall()
    return {r["achievement_key"] for r in rows}


def unlock_achievement(key, unlocked_date):
    """No-op if already unlocked (achievement_key is UNIQUE)."""
    with get_conn() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO achievements (achievement_key, unlocked_date) VALUES (?, ?)",
            (key, unlocked_date),
        )


def get_achievement_stats():
    """Aggregate, all-time counters used to evaluate the achievement catalog. Kept as a
    single query batch since the dataset is small (local single-user tool)."""
    with get_conn() as conn:
        total_food = conn.execute("SELECT COUNT(*) c FROM food_logs").fetchone()["c"]
        total_products = conn.execute("SELECT COUNT(*) c FROM product_logs").fetchone()["c"]
        total_environment = conn.execute("SELECT COUNT(*) c FROM environment_logs").fetchone()["c"]
        total_air_quality = conn.execute("SELECT COUNT(*) c FROM air_quality_logs").fetchone()["c"]
        total_practices = conn.execute("SELECT COUNT(*) c FROM practice_logs").fetchone()["c"]
        total_completed_actions = conn.execute("SELECT COUNT(*) c FROM completed_actions").fetchone()["c"]
        completed_tip_keys = [r["tip_key"] for r in conn.execute("SELECT tip_key FROM completed_actions")]
        all_food_rows = conn.execute("SELECT food_item, notes FROM food_logs").fetchall()
    return {
        "total_food": total_food,
        "total_products": total_products,
        "total_environment": total_environment,
        "total_air_quality": total_air_quality,
        "total_practices": total_practices,
        "total_completed_actions": total_completed_actions,
        "completed_tip_keys": completed_tip_keys,
        "categories_logged": {
            cat for cat, n in [
                ("food", total_food), ("products", total_products),
                ("environment", total_environment), ("air_quality", total_air_quality),
                ("practices", total_practices),
            ] if n > 0
        },
        "all_food_entries": [dict(r) for r in all_food_rows],
    }
