import { getItem, setItem } from "expo-secure-store";

export function readValue(key: string): string | null {
  try {
    return getItem(key);
  } catch {
    return null;
  }
}

export function writeValue(key: string, value: string) {
  try {
    setItem(key, value);
  } catch {
    // Keychain unavailable: the value still applies for this session.
  }
}
