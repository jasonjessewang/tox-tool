/**
 * One generic CRUD router factory reused for all 6 log tables, so adding a 7th log
 * type later (as the mobile app's own screen list grows) is a one-line addition here,
 * not a new hand-written route file.
 */
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { db, LOG_TABLE_NAMES, type LogTableName } from "./db.ts";
import { requireApiKey, userIdOf, type AuthedRequest } from "./auth.ts";
import { buildIntegrationsRouter } from "./integrations/routes.ts";
import { buildEvidenceRouter } from "./evidence.ts";
import { buildOcrRouter } from "./ocr.ts";
import { encodeCursor, decodeCursor, clampLimit } from "./pagination.ts";

const TABLE_FIELDS: Record<LogTableName, string[]> = {
  food_logs: ["meal", "food_item", "processing_level", "notes"],
  product_logs: ["product_type", "product_name", "ingredients_text", "notes"],
  environment_logs: ["location", "condition_type", "detail", "notes"],
  air_quality_logs: ["location", "pollutant", "value", "source", "notes"],
  practice_logs: ["practice_type", "duration_minutes", "detail", "notes"],
  biomarker_logs: ["metric", "value", "unit", "source", "notes"],
};

function buildLogRouter(table: LogTableName): Router {
  const router = Router();
  const fields = TABLE_FIELDS[table];

  router.get("/", requireApiKey("read"), (req: AuthedRequest, res) => {
    const userId = userIdOf(req);
    const limit = clampLimit(req.query.limit);
    const cursor = decodeCursor(req.query.cursor as string | undefined);
    const since = req.query.since as string | undefined;
    const until = req.query.until as string | undefined;

    const conditions = ["user_id = ?"];
    const params: (string | number)[] = [userId];
    if (since) {
      conditions.push("log_date >= ?");
      params.push(since);
    }
    if (until) {
      conditions.push("log_date <= ?");
      params.push(until);
    }
    if (cursor !== null) {
      conditions.push("seq < ?");
      params.push(cursor);
    }

    const start = performance.now();
    const rows = db
      .prepare(
        `SELECT * FROM ${table} WHERE ${conditions.join(" AND ")} ORDER BY log_date DESC, seq DESC LIMIT ?`
      )
      .all(...params, limit + 1);
    const elapsedMs = performance.now() - start;

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? encodeCursor((page[page.length - 1] as any).seq) : null;

    res.set("Server-Timing", `db;dur=${elapsedMs.toFixed(2)}`);
    res.json({ data: page, next_cursor: nextCursor, count: page.length });
  });

  router.post("/", requireApiKey("write"), (req: AuthedRequest, res) => {
    const userId = userIdOf(req);
    const body = req.body ?? {};
    if (!body.log_date) {
      res.status(400).json({ error: "log_date is required" });
      return;
    }
    const id = randomUUID();
    const cols = ["id", "user_id", "log_date", ...fields];
    const placeholders = cols.map(() => "?").join(", ");
    const values = [id, userId, body.log_date, ...fields.map((f) => body[f] ?? null)];

    db.prepare(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`).run(...values);
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    res.status(201).json({ data: row });
  });

  router.delete("/:id", requireApiKey("write"), (req: AuthedRequest, res) => {
    const userId = userIdOf(req);
    const result = db
      .prepare(`DELETE FROM ${table} WHERE id = ? AND user_id = ?`)
      .run(req.params.id, userId);
    if (result.changes === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).send();
  });

  return router;
}

export function buildApiRouter(): Router {
  const api = Router();

  const ROUTE_NAMES: Record<LogTableName, string> = {
    food_logs: "food-logs",
    product_logs: "product-logs",
    environment_logs: "environment-logs",
    air_quality_logs: "air-quality-logs",
    practice_logs: "practice-logs",
    biomarker_logs: "biomarker-logs",
  };

  for (const table of LOG_TABLE_NAMES) {
    api.use(`/${ROUTE_NAMES[table]}`, buildLogRouter(table));
  }

  api.use("/", buildIntegrationsRouter());
  api.use("/evidence", buildEvidenceRouter());
  api.use("/ocr", buildOcrRouter());

  api.get("/completed-actions", requireApiKey("read"), (req: AuthedRequest, res) => {
    const userId = userIdOf(req);
    const since = req.query.since as string | undefined;
    const conditions = ["user_id = ?"];
    const params: (string | number)[] = [userId];
    if (since) {
      conditions.push("completed_date >= ?");
      params.push(since);
    }
    const rows = db
      .prepare(`SELECT * FROM completed_actions WHERE ${conditions.join(" AND ")} ORDER BY seq DESC LIMIT 500`)
      .all(...params);
    res.json({ data: rows });
  });

  api.post("/completed-actions", requireApiKey("write"), (req: AuthedRequest, res) => {
    const userId = userIdOf(req);
    const { tip_key, tip_text, completed_date } = req.body ?? {};
    if (!tip_key || !completed_date) {
      res.status(400).json({ error: "tip_key and completed_date are required" });
      return;
    }
    const id = randomUUID();
    db.prepare(
      "INSERT INTO completed_actions (id, user_id, tip_key, tip_text, completed_date) VALUES (?, ?, ?, ?, ?)"
    ).run(id, userId, tip_key, tip_text ?? "", completed_date);
    res.status(201).json({ data: db.prepare("SELECT * FROM completed_actions WHERE id = ?").get(id) });
  });

  api.get("/achievements", requireApiKey("read"), (req: AuthedRequest, res) => {
    const userId = userIdOf(req);
    const rows = db.prepare("SELECT achievement_key, unlocked_date FROM achievements WHERE user_id = ?").all(userId);
    res.json({ data: rows });
  });

  api.post("/achievements/:key/unlock", requireApiKey("write"), (req: AuthedRequest, res) => {
    const userId = userIdOf(req);
    const today = new Date().toISOString().slice(0, 10);
    try {
      db.prepare(
        "INSERT INTO achievements (user_id, achievement_key, unlocked_date) VALUES (?, ?, ?)"
      ).run(userId, req.params.key, today);
      res.status(201).json({ unlocked: true });
    } catch {
      res.status(200).json({ unlocked: false, reason: "already unlocked" });
    }
  });

  return api;
}
