/**
 * For the one thing the app stores that is a real credential (the self-hosted backend's API key, which can read and
 * write someone's logged health entries): the OS keychain on iOS/Android via expo-secure-store, not AsyncStorage's
 * plain-text file. expo-secure-store has no web build at all (its own docs list only android/ios/tvos/expo-go), so web
 * keeps using AsyncStorage -- the same place every other, non-sensitive setting already lives there.
 */
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

export async function getSecureItem(key: string): Promise<string | null> {
  return Platform.OS === "web" ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") return AsyncStorage.setItem(key, value);
  return SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === "web") return AsyncStorage.removeItem(key);
  return SecureStore.deleteItemAsync(key);
}
