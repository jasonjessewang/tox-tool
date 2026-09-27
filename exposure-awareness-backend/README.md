# Exposure Awareness — Backend

A local-first REST API + SQLite database, designed for the three properties the ask
named directly — **low latency, easily sorted, smooth pulls** — plus a built-in
extension point for **other apps/integrations** to plug into later. Verified with 11
passing tests (`npm test`), including a real p95 latency assertion and a user-isolation
check, not just unit-level mocks.

## Why this stack

- **`node:sqlite`** (Node's built-in module, stable since Node 22.5) instead of
  `better-sqlite3` or any other native-addon package. This machine's Xcode was just
  upgraded to 27, which broke native gem/npm extension compilation for anything
  depending on Ruby framework headers (hit this directly trying to install CocoaPods for
  the mobile build). `node:sqlite` ships inside the Node binary itself — zero native
  compilation, zero exposure to that whole class of environment breakage.
- **Plain `.ts` files run directly by Node** — no ts-node, no build step, no tsx. Node
  24 strips TypeScript types natively. One less moving part.
- **Express**, because the ask was about the database's performance characteristics, not
  the web framework — Express is the boring, well-understood choice here on purpose.

## What "low latency, easily sorted, smooth pulls" actually means in the schema

- **WAL journal mode** (`PRAGMA journal_mode = WAL`): readers don't block writers and
  vice versa — the standard SQLite config for concurrent access latency.
- **Every log table has a composite index** on `(user_id, log_date DESC, seq DESC)` —
  the two query shapes every screen needs ("recent N" and "date range") are both covered
  by that one index, so list queries never full-scan.
- **Keyset (cursor) pagination, not OFFSET**: a cursor is just the last-seen `seq`
  (SQLite rowid), base64-encoded. `WHERE seq < ?` stays index-backed at any page depth;
  OFFSET-based pagination gets linearly slower the deeper you page, because the database
  has to walk and discard every prior row first. See `src/pagination.ts`.
- **`user_id` on every table from day one**, even though the mobile app is currently
  single-user/local-only (`user_id = 'local'`). Multi-tenancy is cheap to design in now
  and expensive to retrofit later — verified by the "users are isolated" test.
- **Measured, not just claimed**: `tests/api.test.ts`'s last test inserts 500 rows
  concurrently, then asserts p95 read latency stays under 50ms on an indexed query — a
  regression guard, not a formal SLA, but it means "someone silently dropped the index"
  would fail CI, not just look fine until it doesn't.

## The "other apps" integration point: API keys

`src/auth.ts` — scoped (`read` / `read,write`), revocable, SHA-256-hashed at rest (the
raw key is shown exactly once, at creation, same as Stripe/GitHub/etc.). Minting a key is
a **local CLI command**, not an open HTTP endpoint — issuing credentials is an operator
action, not something exposed over the network unauthenticated:

```bash
npm run create-key -- "My Integration Name" read        # read-only key
npm run create-key -- "My Integration Name" read,write   # full access
```

Every request needs `Authorization: Bearer <key>`. A future partner integration (an
AirNow poller, a workout-app sync job, a research collaborator) gets its own scoped key
rather than ever touching the actual user's credentials.

## Running it

```bash
npm install
npm test              # 11 tests: CRUD, pagination, auth, isolation, latency
npm run create-key -- "local-dev"
npm run dev            # http://localhost:4000, auto-restarts on file changes
```

## API surface

All routes under `/v1`, all requiring `Authorization: Bearer <key>`. `X-User-Id` header
selects the user (defaults to `local`) — this is where a real auth layer would plug in
later without touching any query, since every query already filters by `user_id`.

| Route | Methods | Notes |
|---|---|---|
| `/v1/food-logs` | GET, POST | `?since=&until=&cursor=&limit=` |
| `/v1/product-logs` | GET, POST | same query params |
| `/v1/environment-logs` | GET, POST | same query params |
| `/v1/air-quality-logs` | GET, POST | same query params |
| `/v1/practice-logs` | GET, POST | same query params |
| `/v1/biomarker-logs` | GET, POST | same query params |
| `/v1/{table}/:id` | DELETE | 204 on success, 404 if already gone |
| `/v1/completed-actions` | GET, POST | tip-key completion ledger (achievements, quests) |
| `/v1/achievements` | GET | unlocked achievement keys |
| `/v1/achievements/:key/unlock` | POST | idempotent — 200 with `unlocked:false` if already unlocked |
| `/health` | GET | no auth required |

GET list responses: `{ data: [...], next_cursor: string | null, count: number }`. Also
carries a `Server-Timing: db;dur=<ms>` header on every list response, so a caller (or a
browser's own network panel) can see the actual query time without needing server logs.

## What's not done

- **Not deployed anywhere** — this runs on localhost. Per your call, this stays
  local-first until you've picked a host (Postgres via Supabase/Railway/Fly.io, or
  keep SQLite on a small VM) — the schema and query patterns here translate directly;
  the main change would be swapping `node:sqlite` for a Postgres client behind the same
  function signatures in `db.ts`.
- **The mobile app doesn't call this yet** — it still reads/writes `AsyncStorage`
  directly (`exposure-awareness-mobile/src/storage/db.ts`). Wiring the two together is
  a `storage/db.ts` rewrite to call this API instead of AsyncStorage, with the same
  exported function signatures so nothing above that layer (engine, screens) has to change.
- **No rate limiting yet** — fine for local dev, worth adding before any real "other
  apps" integration goes live.

---

## Integrations (linked sources)

One normalized shape (`metric_samples`) for every source; a provider is one adapter that emits `NormalizedSample`.

| Provider | How it links | Status |
| --- | --- | --- |
| Strava | Server-side OAuth2 (`src/integrations/strava.ts`). Client secret stays here, never in the app. | Implemented; tested against mocked Strava responses. Needs your own Strava app credentials to run for real. |
| Google account | Sign-in **identity only** (`openid email profile`). Deliberately no Gmail scopes: mail access is a restricted Google scope and far more than this app needs. | Implemented; needs Google OAuth client credentials. |
| Apple Health / Health Connect (incl. Samsung Health, which syncs into Health Connect) | Read **on the device** by the app (needs a native build, not Expo Go), then pushed to `POST /v1/ingest/samples`. | Ingest endpoint implemented and tested; the on-device readers are not built yet. |

Environment (all optional; a provider with missing config reports `configured: false` and refuses to start a flow):

```
INTEGRATION_KEY=<32 bytes, hex or base64>   # encrypts provider tokens (AES-256-GCM) and signs OAuth state
STRAVA_CLIENT_ID= STRAVA_CLIENT_SECRET= STRAVA_REDIRECT_URI=http://<host>:4000/v1/integrations/strava/callback
GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= GOOGLE_REDIRECT_URI=http://<host>:4000/v1/integrations/google/callback
```

Endpoints (all under `/v1`, API-key auth except the browser callback, which is authenticated by a signed, 10-minute `state`):
`GET /integrations`, `POST /integrations/:provider/authorize`, `GET /integrations/:provider/callback`, `POST /integrations/strava/sync`, `DELETE /integrations/:provider?purge=true`, `POST /ingest/samples`, `GET /metrics/daily`.

Note: Strava's API agreement restricts some uses of athlete data (e.g. AI/ML model training and showing one person's data to others). Review it before scaling; the adapter only imports the connected user's own data for their own view.

## Evidence library

`seed/evidence.json` holds 15 papers (12 landmark exposure studies + 3 on how to read statistics) (PMIDs verified against PubMed, citation counts from NIH iCite), each with a one-line headline, a short vignette, a full write-up, key findings, limitations and practical steps. `npm run seed` loads it (also runs on server start; idempotent).

- `GET /v1/evidence?topic=&substance=&concept=&limit=&cursor=` -- ranked by citation count, keyset-paginated, filterable through an indexed link table (so the engine can ask "what is the evidence for substance X").
- `GET /v1/evidence/:id` -- full detail.
- `npm run sync-literature` -- pulls more PubMed records + iCite counts as `needs_summary=1`. **They are never served until a reviewed summary exists.**

The same `evidence.json` is bundled in the mobile app (`src/data/evidence.json`) so it works offline.

## Label OCR

`POST /v1/ocr` (write scope) takes `{ "image_base64": "..." }` and returns `{ text, confidence }`, using tesseract.js (WASM) inside this process. Free, no API key, and label photos never leave your machine. It refuses non-image data (PNG/JPEG/GIF/BMP/WebP only) and survives corrupt images -- the WASM worker reports bad input as an uncaught async error, so the format is checked first and a worker error handler is installed. First call downloads the English language data (~20 s, cached in `.ocr-cache/`).

Quality is good on flat, well-lit, high-contrast labels and worse on curved, glossy or tiny print, and it does misread characters (in the bundled test it read "(55g)" as "(559)"). The app therefore always shows the recognized text for review, and its parsers refuse to trust numbers that lost their units.
