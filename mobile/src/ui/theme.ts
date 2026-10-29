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
  title: {
    fontFamily: font.bold,
    fontSize: 34,
    lineHeight: 41,
    letterSpacing: -1.2,
  },
  heading: {
    fontFamily: font.semibold,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.6,
  },
  section: { fontFamily: font.semibold, fontSize: 18, lineHeight: 28 },
  headline: {
    fontFamily: font.semibold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.4,
  },
  body: {
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  label: {
    fontFamily: font.semibold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  button: {
    fontFamily: font.medium,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
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
export const radius = { md: 8, lg: 10, xl: 12, xxl: 16, full: 999 } as const;
export const size = { control: 44, small: 36, maxWidth: 480 } as const;

export const avatarColors: Record<AvatarColor, string> = {
  violet: "#8a2cba",
  blue: "#2c73ba",
  fern: "#1f8452",
  ember: "#ae6029",
  rose: "#ba2c5b",
} as const;

export type Colors = {
  background: string;
  card: string;
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

export const THEMES = ["ink", "sand", "paper", "dawn"] as const;
export type ThemeId = (typeof THEMES)[number];

// Paper (Flexoki, stephango.com/flexoki) is the default. Ink is the plain
// house look, Sand is Tailwind's stone scale, Dawn is Rosé Pine Dawn with Moon
// for dark. Muted text and danger stay at or above 4.5:1 on their backgrounds.
const themes: Record<ThemeId, { light: Colors; dark: Colors }> = {
  ink: {
    light: {
      background: "#ffffff",
      card: "#ffffff",
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

const store = createChoice("circles.theme", THEMES, "paper");
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
