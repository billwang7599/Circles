import type { AvatarColor } from "@circles/shared";
import { useColorScheme } from "react-native";
import { useAppearance } from "../appearance";

export const font = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
} as const;

// Inter Medium at every size, tracked tighter as it grows.
export const typeScale = {
  // The featured event on Home and an event's title on its own screen.
  display: {
    fontFamily: font.medium,
    fontSize: 52,
    lineHeight: 50,
    letterSpacing: -3.1,
  },
  // An event's title on its home tile.
  displaySmall: {
    fontFamily: font.medium,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -2.6,
  },
  // A big number over its small label, as the stats beside a hero read.
  stat: {
    fontFamily: font.regular,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1.2,
  },
  // An inner screen's title, placed in its content.
  title: {
    fontFamily: font.medium,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.7,
  },
  heading: {
    fontFamily: font.medium,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.8,
  },
  section: {
    fontFamily: font.medium,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.7,
  },
  headline: {
    fontFamily: font.medium,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.6,
  },
  button: {
    fontFamily: font.medium,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.4,
  },
  input: {
    fontFamily: font.regular,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.4,
  },
  body: {
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.4,
  },
  label: {
    fontFamily: font.medium,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.4,
  },
  caption: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.3,
  },
} as const;

export const space = {
  xs: 4,
  inline: 6,
  sm: 8,
  md: 12,
  lg: 16,
  gutter: 20,
  xl: 24,
  xxl: 32,
} as const;
export const radius = {
  // Inputs.
  card: 24,
  // Cards, tiles and panels.
  panel: 28,
  // The home sheet's top corners.
  sheet: 36,
  full: 999,
} as const;
export const size = { control: 44, small: 36, maxWidth: 480 } as const;

type Scheme = "light" | "dark";

export const avatarColors: Record<AvatarColor, string> = {
  violet: "#8a2cba",
  blue: "#2c73ba",
  fern: "#1f8452",
  ember: "#ae6029",
  rose: "#ba2c5b",
} as const;

// Each event wears one of these: the tile fill, the ink on it, and the pill
// that sits on the ink's side of the tile, whose text is the tone itself.
export type EventTone = {
  fill: string;
  ink: string;
  chip: string;
  onChip: string;
};

const toneInk = "#141414";

// Mustard, lavender, sage, tomato, rose, olive: saturated notes that stay
// the same in both appearances, in the order events hash onto them.
const eventTones: readonly EventTone[] = [
  "#e8c66e",
  "#b7aee8",
  "#a8cabd",
  "#e6714c",
  "#dfaab6",
  "#d1cf9d",
].map((fill) => ({ fill, ink: toneInk, chip: toneInk, onChip: fill }));

// Keyed on the id, so an event keeps its colour for life.
export function eventTone(eventId: string): EventTone {
  let hash = 0;
  for (const char of eventId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return eventTones[Math.abs(hash) % eventTones.length]!;
}

export type Colors = {
  // The paper every screen sits on.
  background: string;
  // Chalk: cards, inputs, secondary buttons and chips.
  card: string;
  // The raised chalk panel the home screen's events sit on.
  sheet: string;
  // A quiet fill for panels and muted rows.
  surface: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  // Pencil: secondary text, placeholders, muted icons.
  textMuted: string;
  // Hairline dividers.
  border: string;
  // The outline of inputs, chips, tabs and round buttons.
  input: string;
  danger: string;
};

// Pencil and danger stay at or above 4.5:1 on the paper and the chalk.
const palette: Record<Scheme, Colors> = {
  light: {
    background: "#e8e6e1",
    card: "#f5f4f0",
    sheet: "#f5f4f0",
    surface: "#dbd9d2",
    foreground: "#111111",
    primary: "#111111",
    primaryForeground: "#ffffff",
    textMuted: "#64635e",
    border: "#cfccc5",
    input: "#b9b6ae",
    danger: "#b93a1c",
  },
  dark: {
    background: "#141413",
    card: "#1f1f1d",
    sheet: "#242422",
    surface: "#2a2a27",
    foreground: "#f2f2ee",
    primary: "#f2f2ee",
    primaryForeground: "#141413",
    textMuted: "#a3a39d",
    border: "#33332f",
    input: "#55554f",
    danger: "#f97066",
  },
};

export function useTheme() {
  const system = useColorScheme();
  const appearance = useAppearance();
  const scheme: Scheme =
    (appearance === "system" ? system : appearance) === "dark"
      ? "dark"
      : "light";
  return { scheme, colors: palette[scheme] };
}
