import Feather from "@expo/vector-icons/Feather";
import { Platform } from "react-native";
import {
  SymbolView,
  type SymbolViewProps,
  type SymbolWeight,
} from "expo-symbols";

export type IconName =
  | "arrow-left"
  | "arrow-right"
  | "ban"
  | "calendar"
  | "check"
  | "chevron-right"
  | "clock"
  | "gear"
  | "hash"
  | "heart"
  | "lock"
  | "lock-open"
  | "log-out"
  | "mail"
  | "map"
  | "map-pin"
  | "moon"
  | "moon-star"
  | "pencil"
  | "plus"
  | "search"
  | "share"
  | "sparkles"
  | "star"
  | "sun"
  | "sun-moon"
  | "sunset"
  | "triangle-alert"
  | "users"
  | "wallet"
  | "xmark"
  | "zap";

const symbols: Record<IconName, SymbolViewProps["name"]> = {
  "arrow-left": "arrow.left",
  "arrow-right": "arrow.right",
  ban: "nosign",
  calendar: "calendar",
  check: "checkmark",
  "chevron-right": "chevron.right",
  clock: "clock",
  gear: "gearshape",
  hash: "number",
  heart: "heart",
  lock: "lock",
  "lock-open": "lock.open",
  "log-out": "rectangle.portrait.and.arrow.right",
  mail: "envelope",
  map: "map",
  "map-pin": "mappin.and.ellipse",
  moon: "moon",
  "moon-star": "moon.stars",
  pencil: "pencil",
  plus: "plus",
  search: "magnifyingglass",
  share: "square.and.arrow.up",
  sparkles: "sparkles",
  star: "star",
  sun: "sun.max",
  "sun-moon": "circle.lefthalf.filled",
  sunset: "sun.horizon",
  "triangle-alert": "exclamationmark.triangle",
  users: "person.2",
  wallet: "wallet.pass",
  xmark: "xmark",
  zap: "bolt",
};

// Android and web fall back to Feather, whose names mostly match ours.
const feather: Record<IconName, React.ComponentProps<typeof Feather>["name"]> =
  {
    "arrow-left": "arrow-left",
    "arrow-right": "arrow-right",
    ban: "slash",
    calendar: "calendar",
    check: "check",
    "chevron-right": "chevron-right",
    clock: "clock",
    gear: "settings",
    hash: "hash",
    heart: "heart",
    lock: "lock",
    "lock-open": "unlock",
    "log-out": "log-out",
    mail: "mail",
    map: "map",
    "map-pin": "map-pin",
    moon: "moon",
    "moon-star": "moon",
    pencil: "edit-2",
    plus: "plus",
    search: "search",
    share: "share",
    sparkles: "star",
    star: "star",
    sun: "sun",
    "sun-moon": "smartphone",
    sunset: "sunset",
    "triangle-alert": "alert-triangle",
    users: "users",
    wallet: "credit-card",
    xmark: "x",
    zap: "zap",
  };

type Props = {
  name: IconName;
  size?: number;
  color: string;
  weight?: SymbolWeight;
};

// Icons only ever sit beside text or inside a labelled control, so screen
// readers skip them; otherwise a symbol's own name ("Number sign") is read too.
const decorative = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
} as const;

export function Icon({ name, size = 16, color, weight = "medium" }: Props) {
  // Off iOS, SymbolView only ever shows the fallback, after loading a font it never draws.
  if (Platform.OS !== "ios")
    return (
      <Feather name={feather[name]} size={size} color={color} {...decorative} />
    );
  return (
    <SymbolView
      name={symbols[name]}
      size={size}
      tintColor={color}
      weight={weight}
      resizeMode="scaleAspectFit"
      {...decorative}
    />
  );
}
