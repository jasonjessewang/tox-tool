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
  "air quality", // i18n-ignore: matched against the National Weather Service's English event names
  "red flag", // i18n-ignore: matched against the National Weather Service's English event names
  "fire weather", // i18n-ignore: matched against the National Weather Service's English event names
  "smoke", // i18n-ignore: matched against the National Weather Service's English event names
  "excessive heat", // i18n-ignore: matched against the National Weather Service's English event names
  "extreme heat", // i18n-ignore: matched against the National Weather Service's English event names
  "heat advisory", // i18n-ignore: matched against the National Weather Service's English event names
  "winter storm", // i18n-ignore: matched against the National Weather Service's English event names
  "ice storm", // i18n-ignore: matched against the National Weather Service's English event names
  "extreme cold", // i18n-ignore: matched against the National Weather Service's English event names
  "wind chill", // i18n-ignore: matched against the National Weather Service's English event names
  "hurricane", // i18n-ignore: matched against the National Weather Service's English event names
  "tropical storm", // i18n-ignore: matched against the National Weather Service's English event names
  "tornado", // i18n-ignore: matched against the National Weather Service's English event names
  "flash flood", // i18n-ignore: matched against the National Weather Service's English event names
  "flood warning", // i18n-ignore: matched against the National Weather Service's English event names
];

function isSignificant(event: string): boolean {
  const lower = event.toLowerCase();
  return SIGNIFICANT_EVENT_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function fetchSignificantAlerts(coords: { latitude: number; longitude: number }): Promise<WeatherAlert[]> {
  const url = `https://api.weather.gov/alerts/active?point=${coords.latitude},${coords.longitude}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "exposure-awareness-mobile/1.0 (local personal-use app, no server)" }, // i18n-ignore
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
