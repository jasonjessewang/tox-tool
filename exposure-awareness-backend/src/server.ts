import express from "express";
import { buildApiRouter } from "./routes.ts";
import { seedEvidence } from "./seed-evidence.ts";

const app = express();
app.use(express.json({ limit: "14mb" })); // label photos arrive base64-encoded

// Coarse latency visibility on every response, not just the paginated list endpoints --
// cheap to add now, useful the moment "other apps" start depending on this.
app.use((req, res, next) => {
  const start = performance.now();
  res.on("finish", () => {
    const ms = (performance.now() - start).toFixed(2);
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

seedEvidence();
app.use("/v1", buildApiRouter());

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`exposure-awareness-backend listening on http://localhost:${PORT}`);
});
