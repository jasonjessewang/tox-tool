/**
 * What the phone builds declare to iOS, Android and the stores. Checked against app.json, which is what `expo prebuild` and
 * EAS Build generate the native projects from (2026-10-03: generated both and read the resulting Info.plist and
 * AndroidManifest.xml to confirm these land as written).
 *
 * The rule: every permission string says what this app does with it, or says plainly that this app does not use it. A
 * framework's stock "Allow $(PRODUCT_NAME) to access your ..." tells a person nothing, and promises nothing.
 */
import * as fs from "fs";
import * as path from "path";

const app = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app.json"), "utf8")).expo as {
  plugins: (string | [string, Record<string, unknown>])[];
  android: { blockedPermissions?: string[] };
  userInterfaceStyle: string;
};
const options = (name: string) => {
  const p = app.plugins.find((x) => (Array.isArray(x) ? x[0] : x) === name);
  if (!p) throw new Error(`plugin ${name} is not configured`);
  return Array.isArray(p) ? p[1] : {};
};

const PERMISSION_TEXT: [string, string[]][] = [
  ["expo-location", ["locationWhenInUsePermission", "locationAlwaysAndWhenInUsePermission", "locationAlwaysPermission", "motionUsagePermission"]],
  ["expo-camera", ["cameraPermission", "microphonePermission"]],
  ["expo-image-picker", ["photosPermission", "cameraPermission"]],
  ["expo-secure-store", ["faceIDPermission"]],
];

test("every permission string is this app's own words, never a framework's stock sentence", () => {
  for (const [plugin, keys] of PERMISSION_TEXT) {
    for (const key of keys) {
      const text = options(plugin)[key];
      expect({ plugin, key, type: typeof text }).toEqual({ plugin, key, type: "string" });
      expect(text as string).not.toMatch(/\$\(PRODUCT_NAME\)|^Allow /);
      expect((text as string).length).toBeGreaterThan(40);
    }
  }
});

test("what the app does not use, it says it does not use", () => {
  for (const [plugin, key] of [["expo-location", "motionUsagePermission"], ["expo-camera", "microphonePermission"], ["expo-secure-store", "faceIDPermission"]]) {
    expect(options(plugin)[key]).toMatch(/^Not used by this app/);
  }
  for (const key of ["locationAlwaysAndWhenInUsePermission", "locationAlwaysPermission"]) expect(options("expo-location")[key]).toMatch(/never asks for your location in the background/);
});

test("location is only ever read while the app is open, and nothing records audio or draws over other apps", () => {
  expect(options("expo-location").isIosBackgroundLocationEnabled).toBe(false);
  expect(options("expo-location").isAndroidBackgroundLocationEnabled).toBe(false);
  expect(options("expo-camera").recordAudioAndroid).toBe(false);
  expect(options("expo-image-picker").microphonePermission).toBe(false);
  expect(app.android.blockedPermissions).toContain("android.permission.SYSTEM_ALERT_WINDOW");
});

test("the permission strings name where data goes, the same places About you > What leaves this device names", () => {
  expect(options("expo-location").locationWhenInUsePermission).toMatch(/National Weather Service/);
  expect(options("expo-location").locationWhenInUsePermission).toMatch(/Open-Meteo/);
  expect(options("expo-camera").cameraPermission).toMatch(/Open Food Facts/);
  const profile = fs.readFileSync(path.join(__dirname, "screens", "ProfileScreen.tsx"), "utf8");
  for (const name of ["Open-Meteo", "National Weather Service", "Open Food Facts", "Open Beauty Facts"]) expect(profile).toContain(name);
});
