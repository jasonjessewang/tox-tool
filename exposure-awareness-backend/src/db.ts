/**
 * SQLite via Node's built-in `node:sqlite` (stable in Node 22.5+, ships with the
 * runtime -- zero native-extension compilation, which matters on this machine: a
 * fresh Xcode 27 install just broke `gem install cocoapods`'s native builds because
 * Apple stopped shipping Ruby.framework headers in the SDK. node:sqlite sidesteps
 * that whole class of problem entirely.
 *
 * Design goals from the ask (low latency, easily sorted, smooth pulls, future API
 * integrations):
 *  - WAL journal mode: readers don't block writers, writers don't block readers --
 *    the standard "low latency under concurrent access" SQLite config.
 *  - Every log table has a `user_id` column from day one, even though the mobile app
 *    is currently single-user/local-only -- multi-tenancy is a schema decision that's
 *    expensive to retrofit later and cheap to include now.
 *  - Composite indexes on (user_id, log_date DESC, seq DESC) on every table: the two
 *    query shapes every screen actually needs are "recent N" and "date range," and
 *    both are covered by one index per table rather than a full scan.
 *  - `seq` (the SQLite rowid, aliased) is the cursor pagination key -- see
 *    pagination.ts. Keyset pagination (`seq < ?`) stays O(log n) via the index at any
 *    page depth, unlike OFFSET pagination which degrades linearly -- the concrete
 *    mechanism behind "smooth pulls" at scale.
 *  - `api_keys` table exists from day one as the integration point for "other apps" --
 *    see auth.ts. Scoped, revocable, never a shared password.
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, "..", "exposure.db");

export const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA synchronous = NORMAL"); // safe with WAL, meaningfully faster than FULL
db.exec("PRAGMA foreign_keys = ON");
// Express handles requests concurrently by default -- e.g. a food-log POST and an
// OAuth sync callback can both reach for a write at the same instant. WAL lets readers
// and writers coexist, but two writers still briefly contend for SQLite's one write
// lock; without a busy_timeout that collision throws SQLITE_BUSY immediately instead
// of waiting the (typically single-digit-millisecond) moment for the other write to
// finish and retrying.
db.exec("PRAGMA busy_timeout = 5000");

const LOG_TABLES = [
  {
    name: "food_logs",
    columns: `
      meal TEXT NOT NULL,
      food_item TEXT NOT NULL,
      processing_level INTEGER,
      notes TEXT
    `,
  },
  {
    name: "product_logs",
    columns: `
      product_type TEXT NOT NULL,
      product_name TEXT NOT NULL,
      ingredients_text TEXT,
      notes TEXT
    `,
  },
  {
    name: "environment_logs",
    columns: `
      location TEXT NOT NULL,
      condition_type TEXT NOT NULL,
      detail TEXT,
      notes TEXT
    `,
  },
  {
    name: "air_quality_logs",
    columns: `
      location TEXT NOT NULL,
      pollutant TEXT NOT NULL,
      value REAL NOT NULL,
      source TEXT,
      notes TEXT
    `,
  },
  {
    name: "practice_logs",
    columns: `
      practice_type TEXT NOT NULL,
      duration_minutes INTEGER,
      detail TEXT,
      notes TEXT
    `,
  },
  {
    name: "biomarker_logs",
    columns: `
      metric TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT,
      source TEXT,
      notes TEXT
    `,
  },
] as const;

export type LogTableName = (typeof LOG_TABLES)[number]["name"];
export const LOG_TABLE_NAMES: LogTableName[] = LOG_TABLES.map((t) => t.name);

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_hash TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      scopes TEXT NOT NULL DEFAULT 'read,write',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      revoked_at TEXT
    );
  `);

  for (const table of LOG_TABLES) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${table.name} (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL DEFAULT 'local',
        log_date TEXT NOT NULL,
        ${table.columns},
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
    `);
    // Covers both "recent N for this user" and "date range for this user" in one index.
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${table.name}_user_date_seq
      ON ${table.name} (user_id, log_date DESC, seq DESC);
    `);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS completed_actions (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL DEFAULT 'local',
      tip_key TEXT NOT NULL,
      tip_text TEXT NOT NULL,
      completed_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_completed_actions_user_date_seq
      ON completed_actions (user_id, completed_date DESC, seq DESC);
    CREATE INDEX IF NOT EXISTS idx_completed_actions_user_tipkey
      ON completed_actions (user_id, tip_key);
  `);

  // --- Integrations: linked accounts + normalized samples from any source ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS integration_accounts (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      external_id TEXT,
      label TEXT,
      access_token_enc TEXT,
      refresh_token_enc TEXT,
      expires_at INTEGER,
      scopes TEXT,
      last_sync TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE (user_id, provider)
    );

    -- One normalized shape for every source (Strava, Apple Health, Health Connect/Samsung,
    -- manual...). external_id makes re-syncs idempotent.
    CREATE TABLE IF NOT EXISTS metric_samples (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      source TEXT NOT NULL,
      metric TEXT NOT NULL,
      sample_date TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT,
      external_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE (user_id, source, external_id)
    );
    CREATE INDEX IF NOT EXISTS idx_metric_samples_user_date
      ON metric_samples (user_id, sample_date DESC, metric);
  `);

  // --- Evidence library: curated + ingested literature, summarized AND detailed ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS evidence (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      pmid TEXT UNIQUE,
      title TEXT NOT NULL,
      first_author TEXT,
      journal TEXT,
      year INTEGER,
      study_type TEXT,
      evidence_level TEXT,
      citation_count INTEGER NOT NULL DEFAULT 0,
      citations_as_of TEXT,
      citation_source TEXT,
      headline TEXT,
      summary_short TEXT,
      summary_detail TEXT,
      key_findings_json TEXT,
      limitations_json TEXT,
      practical_json TEXT,
      url TEXT,
      source TEXT NOT NULL DEFAULT 'curated',
      needs_summary INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_evidence_rank ON evidence (citation_count DESC, seq);

    -- Join table so the fusion engine can ask "evidence for substance X / concept Y"
    -- with an index instead of scanning JSON.
    CREATE TABLE IF NOT EXISTS evidence_links (
      evidence_id TEXT NOT NULL,
      kind TEXT NOT NULL,   -- 'topic' | 'substance' | 'concept'
      value TEXT NOT NULL,
      PRIMARY KEY (evidence_id, kind, value)
    );
    CREATE INDEX IF NOT EXISTS idx_evidence_links_lookup ON evidence_links (kind, value);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS achievements (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL DEFAULT 'local',
      achievement_key TEXT NOT NULL,
      unlocked_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE (user_id, achievement_key)
    );
  `);
}

/**
 * SQLite's own `user_version` pragma (an integer baked into the file header, no extra
 * table needed) as a schema-version stamp. `CREATE TABLE IF NOT EXISTS` only covers
 * adding brand-new tables -- it silently no-ops against a table that already exists
 * with an older column set, which is exactly the gap that bites later when a column
 * needs to change on a database someone's already been using. Migrations for that day
 * are only written when there's an actual column change to make; this just gives them
 * a version number to key off instead of guessing an installation's history from
 * whichever columns happen to be present.
 */
const SCHEMA_VERSION = 1;
function runMigrations() {
  const { user_version: current } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  if (current > SCHEMA_VERSION) {
    throw new Error(
      `Database schema version (${current}) is newer than this code expects (${SCHEMA_VERSION}) -- refusing to run against it. Update the app before opening this database.`
    );
  }
  // No migrations exist yet (current schema has never shipped a breaking column
  // change) -- when one is needed, add `if (current < N) { db.exec(\`ALTER TABLE ...\`); }`
  // steps here, in order, then bump SCHEMA_VERSION.
  if (current !== SCHEMA_VERSION) {
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
}

initSchema();
runMigrations();
