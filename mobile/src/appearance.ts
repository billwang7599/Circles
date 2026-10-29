import { Appearance } from "react-native";
import { createChoice } from "./store";

export const APPEARANCES = ["system", "light", "dark"] as const;
export type AppearanceChoice = (typeof APPEARANCES)[number];

const store = createChoice("circles.appearance", APPEARANCES, "system");

// Native windows follow the choice too (alerts, keyboard, status bar);
// react-native-web has no setColorScheme, so useTheme reads the choice itself.
function apply(choice: AppearanceChoice) {
  if (typeof Appearance.setColorScheme === "function")
    Appearance.setColorScheme(choice === "system" ? "auto" : choice);
}

apply(store.get());

export const useAppearance = store.useValue;

export function setAppearance(choice: AppearanceChoice) {
  store.set(choice);
  apply(choice);
}
