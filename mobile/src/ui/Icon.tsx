import Feather from "@expo/vector-icons/Feather";
import { Platform } from "react-native";
import {
  SymbolView,
  type SymbolViewProps,
  type SymbolWeight,
} from "expo-symbols";

export type IconName =
  | "calendar"
  | "check"
  | "chevron-right"
  | "clock"
  | "gear"
  | "hash"
  | "lock"
  | "lock-open"
  | "map"
  | "map-pin"
  | "pencil"
  | "plus"
  | "star"
  | "users"
  | "xmark"
  | "zap";

const symbols: Record<IconName, SymbolViewProps["name"]> = {
  calendar: "calendar",
  check: "checkmark",
  "chevron-right": "chevron.right",
  clock: "clock",
  gear: "gearshape",
  hash: "number",
  lock: "lock",
  "lock-open": "lock.open",
  map: "map",
  "map-pin": "mappin.and.ellipse",
  pencil: "pencil",
  plus: "plus",
  star: "star",
  users: "person.2",
  xmark: "xmark",
  zap: "bolt",
};

// Android and web fall back to Feather, whose names mostly match ours.
const feather: Record<IconName, React.ComponentProps<typeof Feather>["name"]> =
  {
    calendar: "calendar",
    check: "check",
    "chevron-right": "chevron-right",
    clock: "clock",
    gear: "settings",
    hash: "hash",
    lock: "lock",
    "lock-open": "unlock",
    map: "map",
    "map-pin": "map-pin",
    pencil: "edit-2",
    plus: "plus",
    star: "star",
    users: "users",
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
