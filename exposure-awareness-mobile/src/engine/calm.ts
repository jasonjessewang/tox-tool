/**
 * Calm-by-design defaults for the launch build: a checkup, not a feed.
 *
 * The app is opened for a check-in and a lesson, then closed. Nothing here counts days in a row, awards points,
 * or nudges the person back on a timer they did not choose. These live in one place so a test can hold them and
 * any future change has to be deliberate (see calm.test.ts).
 */
import type { CheckInTime } from "./types";

export const CALM_DEFAULTS: { checkInTime: CheckInTime; learningMoments: boolean; airQualityNotifications: boolean } = {
  /** The daily check-in reminder stays off until the person turns it on. */
  checkInTime: "off",
  /** Learning moments between screens stay off until the person turns them on under About you. */
  learningMoments: false,
  /** Air quality / weather-alert notifications stay off until the person turns them on under About you. */
  airQualityNotifications: false,
};

/** Learning moments show only for someone who chose them. Absent means off. */
export function learningMomentsOn(profile: { learningMoments?: boolean } | null | undefined): boolean {
  return profile?.learningMoments === true;
}

/** Air quality / weather-alert notifications fire only for someone who chose them. Absent means off. */
export function airQualityNotificationsOn(profile: { airQualityNotifications?: boolean } | null | undefined): boolean {
  return profile?.airQualityNotifications === true;
}
