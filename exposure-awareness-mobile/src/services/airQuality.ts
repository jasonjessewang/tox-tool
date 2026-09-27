/**
 * Live outdoor air quality via Open-Meteo's Air Quality API -- free, keyless, no account,
 * confirmed live (see conversation notes). Classified through engine/aqi.ts's existing EPA
 * breakpoint table so a location-based reading and a manually logged reading are graded on
 * the exact same scale, not two different rulesets.
 */
import * as aqiEngine from "../engine/aqi";
import type { AqiClassification } from "../engine/aqi";
import type { Coords } from "./location";

export interface AirQualitySnapshot {
  pm2_5: number;
  pm10: number;
  fetchedAt: string;
  classification: AqiClassification | null;
}

export async function fetchCurrentAirQuality(coords: Coords): Promise<AirQualitySnapshot | null> {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coords.latitude}&longitude=${coords.longitude}&current=pm2_5,pm10&timezone=auto`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const pm2_5 = data?.current?.pm2_5;
    const pm10 = data?.current?.pm10;
    if (typeof pm2_5 !== "number" || typeof pm10 !== "number") return null;
    return {
      pm2_5,
      pm10,
      fetchedAt: new Date().toISOString(),
      classification: aqiEngine.classify("PM2.5", pm2_5),
    };
  } catch {
    return null;
  }
}
