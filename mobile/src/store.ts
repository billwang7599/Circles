import { useSyncExternalStore } from "react";
import { readValue, writeValue } from "./storage";

// A value kept on the device, read once before the first render so nothing flashes.
export function createStore<T>(
  key: string,
  parse: (raw: string | null) => T,
  serialize: (value: T) => string,
) {
  let current = parse(readValue(key));
  const listeners = new Set<() => void>();
  const read = () => current;
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  return {
    get: read,
    set(value: T) {
      if (value === current) return;
      current = value;
      writeValue(key, serialize(value));
      for (const listener of listeners) listener();
    },
    useValue: () => useSyncExternalStore(subscribe, read, read),
  };
}

export function createChoice<T extends string>(
  key: string,
  options: readonly T[],
  fallback: T,
) {
  return createStore<T>(
    key,
    (raw) => (options.includes(raw as T) ? (raw as T) : fallback),
    (value) => value,
  );
}
