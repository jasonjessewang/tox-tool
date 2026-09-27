/**
 * Strava adapter (OAuth2 authorization-code flow; endpoints per developers.strava.com).
 * The client secret must stay server-side, which is why this lives in the backend and
 * not the mobile app. Requires STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / STRAVA_REDIRECT_URI
 * from an app registered at strava.com/settings/api.
 *
 * Compliance note: Strava's API agreement restricts some uses of athlete data (review it
 * before scaling -- in particular around AI/ML model training and showing one user's data
 * to others). This adapter only imports the connected user's own data for their own view.
 */
import type { NormalizedSample } from "./types.ts";

export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  athlete?: { id: number; username?: string | null; firstname?: string };
}

export interface StravaActivity {
  id: number;
  moving_time: number; // seconds
  start_date_local: string;
  sport_type?: string;
  type?: string;
}

export function stravaConfigured(): boolean {
  return !!(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET && process.env.STRAVA_REDIRECT_URI);
}

export function buildAuthorizeUrl(state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: process.env.STRAVA_REDIRECT_URI!,
    response_type: "code",
    approval_prompt: "auto",
    scope: "activity:read",
    state,
  });
  return `https://www.strava.com/oauth/authorize?${q}`;
}

async function tokenRequest(params: Record<string, string>): Promise<StravaTokens> {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.STRAVA_CLIENT_ID!, client_secret: process.env.STRAVA_CLIENT_SECRET!, ...params }),
  });
  if (!res.ok) throw new Error(`Strava token request failed: ${res.status}`);
  return (await res.json()) as StravaTokens;
}

export const exchangeCode = (code: string) => tokenRequest({ code, grant_type: "authorization_code" });
export const refreshTokens = (refreshToken: string) => tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });

export async function fetchActivities(accessToken: string, afterEpoch: number): Promise<StravaActivity[]> {
  const all: StravaActivity[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${afterEpoch}&per_page=100&page=${page}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Strava activities request failed: ${res.status}`);
    const batch = (await res.json()) as StravaActivity[];
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

export async function deauthorize(accessToken: string): Promise<void> {
  await fetch("https://www.strava.com/oauth/deauthorize", { method: "POST", headers: { authorization: `Bearer ${accessToken}` } }).catch(() => {});
}

/** One sample per activity (idempotent by external_id); the API sums per day at read time. */
export function normalizeActivities(activities: StravaActivity[]): NormalizedSample[] {
  return activities
    .filter((a) => a.moving_time > 0 && a.start_date_local)
    .map((a) => ({
      source: "strava",
      metric: "active_minutes" as const,
      date: a.start_date_local.slice(0, 10),
      value: Math.round((a.moving_time / 60) * 10) / 10,
      unit: "min",
      external_id: `strava:${a.id}`,
    }));
}
