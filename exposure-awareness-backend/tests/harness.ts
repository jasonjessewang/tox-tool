import { unlinkSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

/** Each test file gets its own SQLite file because node --test runs files in parallel. */
export async function startApp(name: string) {
  const file = path.join(dir, `${name}.db`);
  for (const s of ["", "-wal", "-shm"]) if (existsSync(file + s)) unlinkSync(file + s);
  process.env.DB_PATH = file;
  process.env.INTEGRATION_KEY = "a".repeat(64);
  const { db } = await import("../src/db.ts");
  const { buildApiRouter } = await import("../src/routes.ts");
  const { generateApiKey } = await import("../src/auth.ts");
  const express = (await import("express")).default;
  const app = express();
  app.use(express.json({ limit: "14mb" }));
  app.use("/v1", buildApiRouter());
  const apiKey = generateApiKey(name, "read,write");
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const addr = server.address();
  const baseUrl = `http://localhost:${typeof addr === "object" && addr ? addr.port : 0}`;
  const call = (p: string, init: RequestInit = {}) =>
    fetch(baseUrl + p, { ...init, headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", ...(init.headers ?? {}) } });
  const stop = async () => {
    await new Promise<void>((r) => server.close(() => r()));
    db.close();
    for (const s of ["", "-wal", "-shm"]) if (existsSync(file + s)) unlinkSync(file + s);
  };
  return { db, call, baseUrl, apiKey, stop };
}
