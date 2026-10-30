import type { AvatarColor } from "@circles/shared";
import { useColorScheme } from "react-native";
import { useAppearance } from "../appearance";
import { createChoice } from "../store";

export const font = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

export const typeScale = {
  // The big tight headings of the home and calendar screens.
  display: {
    fontFamily: font.semibold,
    fontSize: 52,
    lineHeight: 50,
    letterSpacing: -2.6,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.6,
  },
  heading: {
    fontFamily: font.semibold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.9,
  },
  section: {
    fontFamily: font.medium,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.7,
  },
  headline: {
    fontFamily: font.semibold,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.6,
  },
  body: {
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.4,
  },
  label: {
    fontFamily: font.semibold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  button: {
    fontFamily: font.medium,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.5,
  },
  caption: { fontFamily: font.regular, fontSize: 12, lineHeight: 16 },
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
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 16,
  card: 24,
  sheet: 36,
  full: 999,
} as const;
export const size = { control: 44, small: 36, maxWidth: 480 } as const;

export const avatarColors: Record<AvatarColor, string> = {
  violet: "#8a2cba",
  blue: "#2c73ba",
  fern: "#1f8452",
  ember: "#ae6029",
  rose: "#ba2c5b",
} as const;

// Each circle wears one of these: the card fill, the ink on it, and the
// light text that sits on the ink (member pills, calendar badges).
export type CircleTone = { fill: string; ink: string; onInk: string };

const circleTones: readonly CircleTone[] = [
  { fill: "#dfbb7c", ink: "#5f4518", onInk: "#f4e3c1" },
  { fill: "#b5bdbe", ink: "#3d4a4d", onInk: "#e4e9e9" },
  { fill: "#c89ea4", ink: "#5f2632", onInk: "#f1dde0" },
  { fill: "#b6c4a6", ink: "#36472a", onInk: "#e5ecdc" },
  { fill: "#bab3d0", ink: "#3f375f", onInk: "#e7e3f1" },
];

// Keyed on the id, so a circle keeps its colour as others come and go.
export function circleTone(circleId: string): CircleTone {
  let hash = 0;
  for (const char of circleId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return circleTones[Math.abs(hash) % circleTones.length]!;
}

export type Colors = {
  background: string;
  card: string;
  // The raised panel the home screen's circles sit on.
  sheet: string;
  // A quiet fill for rows that sit on the sheet or the background.
  surface: string;
  control: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  muted: string;
  textMuted: string;
  border: string;
  input: string;
  danger: string;
  progressTrack: string;
};

export const THEMES = ["circles", "ink", "sand", "paper", "dawn"] as const;
export type ThemeId = (typeof THEMES)[number];

// Circles, warm greys with black pills, is the default. Paper is Flexoki
// (stephango.com/flexoki). Ink is the plain
// house look, Sand is Tailwind's stone scale, Dawn is Rosé Pine Dawn with Moon
// for dark. Muted text and danger stay at or above 4.5:1 on their backgrounds.
const themes: Record<ThemeId, { light: Colors; dark: Colors }> = {
  circles: {
    light: {
      background: "#e4e4df",
      card: "#ffffff",
      sheet: "#ffffff",
      surface: "#efefec",
      control: "transparent",
      foreground: "#0a0a0a",
      primary: "#0a0a0a",
      primaryForeground: "#ffffff",
      muted: "#efefec",
      textMuted: "#5f5f5b",
      border: "#d6d6d0",
      input: "#0a0a0a",
      danger: "#b42318",
      progressTrack: "rgba(10,10,10,0.2)",
    },
    dark: {
      background: "#141413",
      card: "#1f1f1d",
      sheet: "#1f1f1d",
      surface: "#2a2a27",
      control: "transparent",
      foreground: "#f2f2ee",
      primary: "#f2f2ee",
      primaryForeground: "#0a0a0a",
      muted: "#2a2a27",
      textMuted: "#a3a39d",
      border: "#33332f",
      input: "#f2f2ee",
      danger: "#f97066",
      progressTrack: "rgba(242,242,238,0.2)",
    },
  },
  ink: {
    light: {
      background: "#ffffff",
      card: "#ffffff",
      sheet: "#ffffff",
      surface: "#f5f5f5",
      control: "#ffffff",
      foreground: "#0a0a0a",
      primary: "#171717",
      primaryForeground: "#fafafa",
      muted: "#f5f5f5",
      textMuted: "#737373",
      border: "#e5e5e5",
      input: "#e5e5e5",
      danger: "#dc2626",
      progressTrack: "rgba(23,23,23,0.2)",
    },
    dark: {
      background: "#1c1c1c",
      card: "#242424",
      sheet: "#242424",
      surface: "#333333",
      control: "rgba(56,56,56,0.3)",
      foreground: "#fafafa",
      primary: "#fafafa",
      primaryForeground: "#171717",
      muted: "#333333",
      textMuted: "#a3a3a3",
      border: "#383838",
      input: "#383838",
      danger: "#f87171",
      progressTrack: "rgba(250,250,250,0.2)",
    },
  },
  sand: {
    light: {
      background: "#fafaf9",
      card: "#ffffff",
      sheet: "#ffffff",
      surface: "#f5f5f4",
      control: "#ffffff",
      foreground: "#1c1917",
      primary: "#292524",
      primaryForeground: "#fafaf9",
      muted: "#f5f5f4",
      textMuted: "#57534e",
      border: "#e7e5e4",
      input: "#d6d3d1",
      danger: "#b91c1c",
      progressTrack: "rgba(41,37,36,0.2)",
    },
    dark: {
      background: "#1c1917",
      card: "#292524",
      sheet: "#292524",
      surface: "#44403c",
      control: "rgba(68,64,60,0.3)",
      foreground: "#fafaf9",
      primary: "#e7e5e4",
      primaryForeground: "#1c1917",
      muted: "#44403c",
      textMuted: "#a8a29e",
      border: "#44403c",
      input: "#57534e",
      danger: "#fca5a5",
      progressTrack: "rgba(231,229,228,0.2)",
    },
  },
  paper: {
    light: {
      background: "#fffcf0",
      card: "#fffcf0",
      sheet: "#fffcf0",
      surface: "#f2f0e5",
      control: "#fffcf0",
      foreground: "#100f0f",
      primary: "#1c1b1a",
      primaryForeground: "#fffcf0",
      muted: "#f2f0e5",
      textMuted: "#6f6e69",
      border: "#e6e4d9",
      input: "#dad8ce",
      danger: "#af3029",
      progressTrack: "rgba(28,27,26,0.2)",
    },
    dark: {
      background: "#100f0f",
      card: "#1c1b1a",
      sheet: "#1c1b1a",
      surface: "#282726",
      control: "rgba(64,62,60,0.3)",
      foreground: "#cecdc3",
      primary: "#cecdc3",
      primaryForeground: "#100f0f",
      muted: "#282726",
      textMuted: "#878580",
      border: "#343331",
      input: "#403e3c",
      danger: "#e8705f",
      progressTrack: "rgba(206,205,195,0.2)",
    },
  },
  dawn: {
    light: {
      background: "#faf4ed",
      card: "#fffaf3",
      sheet: "#fffaf3",
      surface: "#f2e9e1",
      control: "#fffaf3",
      foreground: "#575279",
      primary: "#575279",
      primaryForeground: "#fffaf3",
      muted: "#f2e9e1",
      textMuted: "#6e6a86",
      border: "#dfdad9",
      input: "#cecacd",
      danger: "#a24e68",
      progressTrack: "rgba(87,82,121,0.2)",
    },
    dark: {
      background: "#232136",
      card: "#2a273f",
      sheet: "#2a273f",
      surface: "#393552",
      control: "rgba(57,53,82,0.4)",
      foreground: "#e0def4",
      primary: "#e0def4",
      primaryForeground: "#232136",
      muted: "#393552",
      textMuted: "#9893a5",
      border: "#44415a",
      input: "#56526e",
      danger: "#eb6f92",
      progressTrack: "rgba(224,222,244,0.2)",
    },
  },
};

// Renamed when Circles became the default, so devices move to it once.
const store = createChoice("circles.theme.v2", THEMES, "circles");
export const useThemeChoice = store.useValue;
export const setTheme = store.set;

export function useTheme() {
  const system = useColorScheme();
  const appearance = useAppearance();
  const theme = useThemeChoice();
  const scheme =
    (appearance === "system" ? system : appearance) === "dark"
      ? "dark"
      : "light";
  return { scheme, colors: themes[theme][scheme] };
}
