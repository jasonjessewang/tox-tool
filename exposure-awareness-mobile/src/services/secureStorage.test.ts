/**
 * The backend API key goes to the OS keychain on native, AsyncStorage on web (expo-secure-store has no web build).
 * expo-secure-store is mocked in jest.setup.js (an in-memory stand-in, same idea as AsyncStorage's own jest mock);
 * AsyncStorage itself is also mocked there. Platform.OS is overridden directly per test -- it's a plain mutable
 * property in the test environment's React Native implementation, not a getter.
 */
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { getSecureItem, setSecureItem, deleteSecureItem } from "./secureStorage";

const KEY = "exposure:backend_config";
const realOS = Platform.OS;
afterEach(() => {
  Platform.OS = realOS;
  jest.clearAllMocks();
});

describe("web: AsyncStorage, same as everything else the app stores", () => {
  beforeEach(() => {
    Platform.OS = "web";
  });

  test("round-trips through AsyncStorage, not SecureStore", async () => {
    await setSecureItem(KEY, "eak_abc123");
    expect(await getSecureItem(KEY)).toBe("eak_abc123");
    expect(await AsyncStorage.getItem(KEY)).toBe("eak_abc123");
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  test("delete removes it, and a key never set reads null", async () => {
    await setSecureItem(KEY, "eak_abc123");
    await deleteSecureItem(KEY);
    expect(await getSecureItem(KEY)).toBeNull();
    expect(await getSecureItem("never_set")).toBeNull();
  });
});

describe("native (iOS/Android): the OS keychain, not plain-text storage", () => {
  beforeEach(() => {
    Platform.OS = "ios";
  });

  test("round-trips through SecureStore, and AsyncStorage never sees the value", async () => {
    await setSecureItem(KEY, "eak_abc123");
    expect(await getSecureItem(KEY)).toBe("eak_abc123");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(KEY, "eak_abc123");
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  test("delete removes it from the keychain", async () => {
    await setSecureItem(KEY, "eak_abc123");
    await deleteSecureItem(KEY);
    expect(await getSecureItem(KEY)).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(KEY);
  });

  test("android takes the same path as ios", async () => {
    Platform.OS = "android";
    await setSecureItem(KEY, "eak_xyz");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(KEY, "eak_xyz");
  });
});
