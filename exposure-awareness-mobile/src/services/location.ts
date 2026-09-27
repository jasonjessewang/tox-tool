/**
 * Foreground-only location (expo-location's background modes need a dev build, not
 * available in Expo Go -- see AGENTS.md). Coordinates are cached locally so the air
 * quality / alert cards have something to show between app opens without re-prompting;
 * they're sent to exactly two places (Open-Meteo, NWS), both free/keyless/no-account, and
 * never anywhere else. Confirmed against docs.expo.dev/versions/v57.0.0/sdk/location.
 */
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type LocationPermissionState = "granted" | "denied" | "undetermined";

export interface Coords {
  latitude: number;
  longitude: number;
}

const CACHE_KEY = "exposure:last_coords";

export async function getPermissionState(): Promise<LocationPermissionState> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status as LocationPermissionState;
}

export async function requestPermission(): Promise<LocationPermissionState> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status as LocationPermissionState;
}

async function readCache(): Promise<Coords | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  return raw ? (JSON.parse(raw) as Coords) : null;
}

async function writeCache(coords: Coords): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(coords));
}

/** Returns fresh coordinates, falling back to the last cached fix if a live read fails
 * (e.g. indoors, airplane mode). Returns null only if permission isn't granted and there's
 * no cache to fall back on. */
export async function getCoords(): Promise<Coords | null> {
  const status = await getPermissionState();
  if (status !== "granted") return readCache();

  try {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    await writeCache(coords);
    return coords;
  } catch {
    return readCache();
  }
}

export async function getCachedCoords(): Promise<Coords | null> {
  return readCache();
}

export async function clearCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
}
