import Feather from "@expo/vector-icons/Feather";
import { Platform } from "react-native";
import { SymbolView, type SymbolViewProps } from "expo-symbols";

export type IconName =
  | "arrow-left"
  | "arrow-right"
  | "calendar"
  | "check"
  | "ellipsis"
  | "grip"
  | "link"
  | "lock"
  | "log-out"
  | "mail"
  | "map-pin"
  | "moon-star"
  | "people"
  | "pencil"
  | "plus"
  | "share"
  | "sun"
  | "sun-moon"
  | "sunrise"
  | "sunset"
  | "xmark";

const symbols: Record<IconName, SymbolViewProps["name"]> = {
  "arrow-left": "arrow.left",
  "arrow-right": "arrow.right",
  calendar: "calendar",
  check: "checkmark",
  ellipsis: "ellipsis",
  grip: "line.3.horizontal",
  link: "link",
  lock: "lock",
  "log-out": "rectangle.portrait.and.arrow.right",
  mail: "envelope",
  "map-pin": "mappin.and.ellipse",
  "moon-star": "moon.stars",
  pencil: "pencil",
  people: "person.2.fill",
  plus: "plus",
  share: "square.and.arrow.up",
  sun: "sun.max",
  "sun-moon": "circle.lefthalf.filled",
  sunrise: "sunrise",
  sunset: "sunset",
  xmark: "xmark",
};

// Android and web fall back to Feather, whose names mostly match ours.
const feather: Record<IconName, React.ComponentProps<typeof Feather>["name"]> =
  {
    "arrow-left": "arrow-left",
    "arrow-right": "arrow-right",
    calendar: "calendar",
    check: "check",
    ellipsis: "more-horizontal",
    grip: "menu",
    link: "link",
    lock: "lock",
    "log-out": "log-out",
    mail: "mail",
    "map-pin": "map-pin",
    "moon-star": "moon",
    pencil: "edit-2",
    people: "users",
    plus: "plus",
    share: "share",
    sun: "sun",
    "sun-moon": "smartphone",
    sunrise: "sunrise",
    sunset: "sunset",
    xmark: "x",
  };

type Props = {
  name: IconName;
  size?: number;
  color: string;
};

// Icons only ever sit beside text or inside a labelled control, so screen
// readers skip them; otherwise a symbol's own name ("Envelope") is read too.
const decorative = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
} as const;

export function Icon({ name, size = 16, color }: Props) {
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
      weight="medium"
      resizeMode="scaleAspectFit"
      {...decorative}
    />
  );
}
