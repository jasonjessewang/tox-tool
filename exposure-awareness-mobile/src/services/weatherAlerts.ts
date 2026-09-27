/**
 * Active watches/warnings from api.weather.gov (US National Weather Service) -- free,
 * keyless, no account, confirmed live against a real point query. NWS asks callers to
 * identify themselves via User-Agent rather than an API key, so that's set explicitly
 * rather than left to fetch's default. US-only: NWS has no coverage outside the US, so a
 * non-US coordinate will just return zero matches, not an error.
 *
 * Filtered to the subset of NWS event types actually relevant to an exposure-awareness
 * app -- air quality, wildfire smoke conditions, and acute weather that changes what's
 * safe to be outside in (heat, cold, flood contamination) -- not a general weather-alert
 * feed.
 */
export interface WeatherAlert {
  id: string;
  event: string;
  headline: string;
  severity: string;
  description: string;
  expires: string;
}

const SIGNIFICANT_EVENT_KEYWORDS = [
  "air quality",
  "red flag",
  "fire weather",
  "smoke",
  "excessive heat",
  "extreme heat",
  "heat advisory",
  "winter storm",
  "ice storm",
  "extreme cold",
  "wind chill",
  "hurricane",
  "tropical storm",
  "tornado",
  "flash flood",
  "flood warning",
];

function isSignificant(event: string): boolean {
  const lower = event.toLowerCase();
  return SIGNIFICANT_EVENT_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function fetchSignificantAlerts(coords: { latitude: number; longitude: number }): Promise<WeatherAlert[]> {
  const url = `https://api.weather.gov/alerts/active?point=${coords.latitude},${coords.longitude}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "exposure-awareness-mobile/1.0 (local personal-use app, no server)" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const features: { id: string; properties: Record<string, string> }[] = data?.features ?? [];
    return features
      .filter((f) => isSignificant(f.properties.event ?? ""))
      .map((f) => ({
        id: f.id,
        event: f.properties.event,
        headline: f.properties.headline,
        severity: f.properties.severity,
        description: f.properties.description,
        expires: f.properties.expires,
      }));
  } catch {
    return [];
  }
}
