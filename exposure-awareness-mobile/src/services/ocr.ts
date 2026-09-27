/**
 * Label photo -> text, via YOUR backend's /v1/ocr (tesseract.js; see the backend's src/ocr.ts).
 * Expo Go has no on-device OCR, so without a configured backend the app offers a paste path
 * instead (on iPhone, Live Text in Photos can copy text out of a picture).
 */
import { getBackendConfig, api } from "./backend";

export async function ocrAvailable(): Promise<boolean> {
  return (await getBackendConfig()) !== null;
}

export async function recognizeLabel(imageBase64: string): Promise<{ text: string; confidence: number }> {
  return api<{ text: string; confidence: number }>("/v1/ocr", { method: "POST", body: JSON.stringify({ image_base64: imageBase64 }) });
}
