import { createStore } from "./store";

// The name this device introduced itself with; circles still each keep their own.
const store = createStore<string | null>(
  "circles.name",
  (raw) => (raw && raw.trim() ? raw.trim() : null),
  (value) => value ?? "",
);

export const useProfileName = store.useValue;
export const setProfileName = store.set;
