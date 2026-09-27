// Port of tox-exposure-tool/engine/aqi.py. Same EPA 2024 breakpoint table
// (data/aqiBreakpoints.json), same linear-interpolation-within-band AQI estimate.
import aqiBreakpoints from "../data/aqiBreakpoints.json";

interface Breakpoint {
  lo: number;
  hi: number;
  aqi_lo: number;
  aqi_hi: number;
  category: string;
  color: string;
  guidance: string;
}

export interface AqiClassification {
  category: string;
  aqi_estimate: number;
  color: string;
  guidance: string;
  concern_level: number;
}

function pollutantKey(pollutant: string): "pm25" | "pm10" | null {
  const p = pollutant.trim().toLowerCase().replace(/[\s_]/g, "");
  if (p === "pm25" || p === "pm2.5") return "pm25";
  if (p === "pm10") return "pm10";
  return null;
}

export function classify(pollutant: string, value: number): AqiClassification | null {
  const key = pollutantKey(pollutant);
  if (!key) return null;
  const table = (aqiBreakpoints as any)[key] as Breakpoint[];

  for (let i = 0; i < table.length; i++) {
    const row = table[i];
    if (value >= row.lo && value <= row.hi) {
      const spanVal = row.hi - row.lo;
      const spanAqi = row.aqi_hi - row.aqi_lo;
      const aqi_estimate =
        spanVal === 0 ? row.aqi_lo : Math.round(row.aqi_lo + ((value - row.lo) * spanAqi) / spanVal);
      return {
        category: row.category,
        aqi_estimate,
        color: row.color,
        guidance: row.guidance,
        concern_level: Math.min(5, i),
      };
    }
  }
  const last = table[table.length - 1];
  return {
    category: last.category,
    aqi_estimate: last.aqi_hi,
    color: last.color,
    guidance: last.guidance,
    concern_level: 5,
  };
}
