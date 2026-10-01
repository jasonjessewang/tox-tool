/**
 * This is a single-tenant server you run for yourself, not multi-tenant SaaS, and every route is already behind a
 * Bearer API key -- reflecting the caller's origin costs nothing extra, since (unlike a cookie) a browser never
 * attaches that header to a cross-origin request on its own. Without this, the web build of the app (or any other
 * browser-based client) cannot reach a self-hosted backend on a different origin at all: the browser blocks the
 * response before the app ever sees it. Native apps are not subject to CORS and were unaffected either way.
 */
import type { Request, Response, NextFunction } from "express";

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.header("origin");
  if (origin) res.set("Access-Control-Allow-Origin", origin);
  res.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
}
