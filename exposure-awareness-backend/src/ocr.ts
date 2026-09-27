/**
 * Label OCR via tesseract.js (WASM), running on YOUR backend -- free, no API key, and photos of
 * your pantry never go to a third-party service. Quality is good on flat, well-lit, high-contrast
 * labels and degrades on curved, glossy or tiny print; the app therefore always lets people
 * review and edit the recognized text before anything is analyzed.
 * On-device OCR (Apple Vision / ML Kit) would need a native build and is not used here.
 */
import { Router } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWorker, type Worker } from "tesseract.js";
import { requireApiKey } from "./auth.ts";

const dir = path.dirname(fileURLToPath(import.meta.url));
let workerPromise: Promise<Worker> | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** Only real image formats reach the WASM worker. It reports bad input as an *uncaught* async error,
 * which would take down the whole server, so we refuse anything that isn't recognizably an image. */
export function looksLikeImage(b: Buffer): boolean {
  const h = b.subarray(0, 12);
  const is = (...bytes: number[]) => bytes.every((v, i) => h[i] === v);
  return (
    is(0x89, 0x50, 0x4e, 0x47) || // PNG
    is(0xff, 0xd8, 0xff) || // JPEG
    is(0x47, 0x49, 0x46, 0x38) || // GIF
    is(0x42, 0x4d) || // BMP
    (is(0x52, 0x49, 0x46, 0x46) && h.subarray(8, 12).toString("ascii") === "WEBP")
  );
}

function getWorker(): Promise<Worker> {
  workerPromise ??= createWorker("eng", 1, {
    cachePath: path.join(dir, "..", ".ocr-cache"),
    errorHandler: (err) => console.error("ocr worker error", err),
  });
  return workerPromise;
}

export async function recognize(image: Buffer): Promise<{ text: string; confidence: number }> {
  // One image at a time: a single WASM worker is not re-entrant.
  const job = queue.then(async () => {
    const worker = await getWorker();
    const { data } = await worker.recognize(image);
    return { text: data.text, confidence: Math.round(data.confidence) };
  });
  queue = job.catch(() => undefined);
  return job;
}

export async function shutdownOcr(): Promise<void> {
  if (workerPromise) await (await workerPromise).terminate();
  workerPromise = null;
}

export function buildOcrRouter(): Router {
  const r = Router();
  r.post("/", requireApiKey("write"), async (req, res) => {
    const b64 = typeof req.body?.image_base64 === "string" ? req.body.image_base64.replace(/^data:[^,]+,/, "") : "";
    if (!b64) {
      res.status(400).json({ error: "image_base64 is required" });
      return;
    }
    const buf = Buffer.from(b64, "base64");
    if (buf.length < 100 || buf.length > 10 * 1024 * 1024) {
      res.status(400).json({ error: "image must be between 100 bytes and 10 MB" });
      return;
    }
    if (!looksLikeImage(buf)) {
      res.status(415).json({ error: "unsupported image format (use PNG, JPEG, GIF, BMP or WebP)" });
      return;
    }
    try {
      res.json(await recognize(buf));
    } catch (e) {
      console.error("ocr failed", e);
      res.status(422).json({ error: "Couldn't read that image" });
    }
  });
  return r;
}
