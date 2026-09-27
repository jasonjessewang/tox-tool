/**
 * Local notification triggers. Two platform paths:
 *  - web: browser Notification API (unchanged from the original verified implementation).
 *  - native (iOS/Android): expo-notifications. Local (non-push) notifications, including
 *    scheduling and cancelling, are available in Expo Go per
 *    docs.expo.dev/versions/v57.0.0/sdk/notifications -- only remote push requires a dev
 *    build, which this app doesn't use. API confirmed against that page rather than
 *    guessed, per this project's own standing rule about Expo's API surface changing.
 *
 * Event types wired: achievement unlocks, AQI events (existing), plus the newer
 * location-based air quality / weather-alert events and the scheduled daily check-in
 * reminder (scheduleDaily/cancelScheduled) added for the routine-building pass.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { CheckInTime } from "../engine/types";

export type PermissionState = "granted" | "denied" | "default" | "unsupported";

export const CHECKIN_NOTIFICATION_ID = "daily-checkin";
const CHECKIN_TIMES: Record<Exclude<CheckInTime, "off">, { hour: number; minute: number; label: string }> = {
  morning: { hour: 7, minute: 30, label: "morning" },
  midday: { hour: 12, minute: 0, label: "midday (around lunch)" },
  dinner: { hour: 18, minute: 0, label: "dinner time" },
};

let handlerSet = false;
function ensureHandler() {
  if (handlerSet || Platform.OS === "web") return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  handlerSet = true;
}

function fromNativeStatus(status: string): PermissionState {
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "default";
}

export async function getPermissionState(): Promise<PermissionState> {
  if (Platform.OS === "web") {
    if (typeof Notification === "undefined") return "unsupported";
    return Notification.permission as PermissionState;
  }
  const { status } = await Notifications.getPermissionsAsync();
  return fromNativeStatus(status);
}

export async function requestPermission(): Promise<PermissionState> {
  ensureHandler();
  if (Platform.OS === "web") {
    if (typeof Notification === "undefined") return "unsupported";
    const result = await Notification.requestPermission();
    return result as PermissionState;
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return fromNativeStatus(status);
}

export async function fireLocal(title: string, body: string): Promise<boolean> {
  if (Platform.OS === "web") {
    if (typeof Notification === "undefined") {
      console.log(`[notify:unsupported-platform] ${title} -- ${body}`);
      return false;
    }
    if (Notification.permission !== "granted") {
      console.log(`[notify:no-permission] ${title} -- ${body}`);
      return false;
    }
    new Notification(title, { body });
    return true;
  }

  ensureHandler();
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    console.log(`[notify:no-permission] ${title} -- ${body}`);
    return false;
  }
  await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
  return true;
}

/** Schedules (or replaces) a daily repeating reminder at the given local hour/minute.
 * No-op on web -- expo-notifications doesn't target web, and this app's daily-routine
 * reminder is a native-only feature for now. */
export async function scheduleDaily(id: string, title: string, body: string, hour: number, minute: number): Promise<boolean> {
  if (Platform.OS === "web") {
    console.log(`[notify:unsupported-platform] scheduleDaily(${id}) -- ${title}`);
    return false;
  }
  ensureHandler();
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return false;

  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
  return true;
}

export async function cancelScheduled(id: string): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

/** Single place that turns a profile's checkInTime preference into an actual scheduled
 * (or cancelled) daily reminder -- shared by onboarding and the Profile settings screen so
 * the two never drift out of sync on copy or timing. Returns true if a reminder is now
 * active (false for "off" or if permission isn't granted). */
export async function applyCheckInSchedule(checkInTime: CheckInTime): Promise<boolean> {
  if (checkInTime === "off") {
    await cancelScheduled(CHECKIN_NOTIFICATION_ID);
    return false;
  }
  const { hour, minute, label } = CHECKIN_TIMES[checkInTime];
  return scheduleDaily(
    CHECKIN_NOTIFICATION_ID,
    "Daily check-in",
    "Two minutes: how today went, and one thing for tomorrow.",
    hour,
    minute
  ).then((ok) => {
    if (!ok) console.log(`[notify:checkin] not scheduled for ${label} -- permission not granted`);
    return ok;
  });
}
