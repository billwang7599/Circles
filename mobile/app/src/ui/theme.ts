import { Platform, useColorScheme } from "react-native";

export const font = {
  regular: "Figtree_400Regular",
  semibold: "Figtree_600SemiBold",
  bold: "Figtree_700Bold",
  mono: Platform.select({ ios: "Menlo", default: "monospace" }),
} as const;

export const typeScale = {
  display: {
    fontFamily: font.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.4,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  heading: { fontFamily: font.semibold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: font.semibold, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: font.regular, fontSize: 13, lineHeight: 16 },
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  gutter: 20,
} as const;
export const radius = { control: 12, card: 16, full: 999 } as const;
export const size = { control: 52, tap: 48, maxWidth: 480 } as const;

const palette = {
  light: {
    canvas: "#FAF8F5",
    surface: "#FFFFFF",
    text: "#1B1917",
    textMuted: "#6B6560",
    border: "#E8E3DD",
    accent: "#D9553F",
    onAccent: "#FFFFFF",
    success: "#2F7D4F",
    danger: "#B3261E",
  },
  dark: {
    canvas: "#141210",
    surface: "#1F1C19",
    text: "#F3EFEA",
    textMuted: "#A39C94",
    border: "#2E2A26",
    accent: "#F0735B",
    onAccent: "#FFFFFF",
    success: "#5DBE82",
    danger: "#F2766E",
  },
};

export type Colors = typeof palette.light;

export function useTheme() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return { scheme, colors: palette[scheme] };
}
