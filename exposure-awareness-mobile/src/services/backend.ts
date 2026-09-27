/**
 * Client for exposure-awareness-backend. The app is local-first and fully works without it;
 * the backend adds server-side OAuth (Strava, Google sign-in), which needs client secrets
 * that must never ship inside a mobile app. Config lives on-device only.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "exposure:backend_config";

export interface BackendConfig {
  baseUrl: string;
  apiKey: string;
}

export async function getBackendConfig(): Promise<BackendConfig | null> {
  const raw = await AsyncStorage.getItem(KEY);
  const c = raw ? (JSON.parse(raw) as BackendConfig) : null;
  return c?.baseUrl && c?.apiKey ? c : null;
}

export async function saveBackendConfig(c: BackendConfig): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify({ baseUrl: c.baseUrl.trim().replace(/\/+$/, ""), apiKey: c.apiKey.trim() }));
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cfg = await getBackendConfig();
  if (!cfg) throw new Error("Backend is not configured");
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export interface ServerProvider {
  id: string;
  name: string;
  mode: "server_oauth" | "on_device" | "identity";
  configured: boolean;
  connected: boolean;
  account: string | null;
  last_sync: string | null;
  note: string;
}

export const listIntegrations = () => api<{ data: ServerProvider[] }>("/v1/integrations").then((r) => r.data);
export const startAuthorize = (id: string) => api<{ url: string }>(`/v1/integrations/${id}/authorize`, { method: "POST" }).then((r) => r.url);
export const syncStrava = () => api<{ imported: number }>("/v1/integrations/strava/sync", { method: "POST" });
export const disconnect = (id: string) => api<void>(`/v1/integrations/${id}`, { method: "DELETE" });
export const fetchDailyMetrics = (since: string) =>
  api<{ data: { date: string; metric: string; value: number; sources: string[] }[] }>(`/v1/metrics/daily?since=${since}`).then((r) => r.data);
