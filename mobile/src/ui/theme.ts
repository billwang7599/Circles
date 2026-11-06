import type { AvatarColor } from "@circles/shared";
import { useColorScheme } from "react-native";
import { useAppearance } from "../appearance";

export const font = {
  light: "Inter_300Light",
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

export const typeScale = {
  // The giant numerals and words that open a screen ("05 NOV", "Goals").
  hero: {
    fontFamily: font.medium,
    fontSize: 88,
    lineHeight: 84,
    letterSpacing: -5.3,
  },
  // The big tight headings of the home and calendar screens.
  display: {
    fontFamily: font.medium,
    fontSize: 52,
    lineHeight: 50,
    letterSpacing: -3.1,
  },
  title: {
    fontFamily: font.medium,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.7,
  },
  // A big number over its small label, as the stats beside a hero read.
  stat: {
    fontFamily: font.regular,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1.2,
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
  button: {
    fontFamily: font.medium,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.4,
  },
  caption: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.3,
  },
  // The next plan, across the top of home.
  planTitle: {
    fontFamily: font.bold,
    fontSize: 46,
    lineHeight: 46,
    letterSpacing: -2.53,
  },
  pageTitle: {
    fontFamily: font.bold,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -1.98,
  },
  month: {
    fontFamily: font.bold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -2.2,
  },
  tileName: {
    fontFamily: font.semibold,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -1.44,
  },
  cardTitle: {
    fontFamily: font.semibold,
    fontSize: 22,
    lineHeight: 25,
    letterSpacing: -0.66,
  },
  listTitle: {
    fontFamily: font.semibold,
    fontSize: 18,
    lineHeight: 28,
    letterSpacing: -0.27,
  },
  strong: {
    fontFamily: font.semibold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.255,
  },
  fieldLabel: {
    fontFamily: font.semibold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.225,
  },
  callout: {
    fontFamily: font.regular,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.24,
  },
  tag: {
    fontFamily: font.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.06,
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
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 16,
  // An availability cell.
  cell: 18,
  dialog: 18,
  panel: 22,
  card: 24,
  list: 26,
  sheet: 32,
  full: 999,
} as const;
export const size = { control: 44, small: 36, maxWidth: 480 } as const;

export type Scheme = "light" | "dark";

export const avatarColors: Record<AvatarColor, string> = {
  violet: "#8a2cba",
  blue: "#2c73ba",
  fern: "#1f8452",
  ember: "#ae6029",
  rose: "#ba2c5b",
} as const;

// Each circle wears one of these: the card fill, the ink on it, and the chip
// that sits on the ink's side of the card (member pills, calendar badges).
export type CircleTone = {
  fill: string;
  ink: string;
  chip: string;
  onChip: string;
};

const tone = (fill: string, ink: string, chip: string): CircleTone => ({
  fill,
  ink,
  chip,
  onChip: "rgba(255,255,255,0.95)",
});

// In the order circles hash onto them, so a circle keeps its hue. Mustard, sage
// and rose are the design's; lavender, clay and olive are derived to match.
const circleTones: readonly Record<Scheme, CircleTone>[] = [
  {
    light: tone("#ddb876", "#6b4e1c", "#7a5a22"),
    dark: tone("#b8924f", "#2b1f09", "#3a2a0e"),
  },
  {
    light: tone("#b3aed0", "#413a66", "#443c6e"),
    dark: tone("#8c86ab", "#191530", "#211b3b"),
  },
  {
    light: tone("#b5bdbc", "#3c4645", "#3f4a49"),
    dark: tone("#8d9695", "#161c1b", "#1e2524"),
  },
  {
    light: tone("#d6a18c", "#662f1d", "#6e3420"),
    dark: tone("#ae7a64", "#2e140b", "#3a1a0f"),
  },
  {
    light: tone("#cfa1a7", "#6b2a33", "#5e2028"),
    dark: tone("#a9787f", "#2e0e13", "#2e0e13"),
  },
  {
    light: tone("#c0bf94", "#4f4e24", "#54532a"),
    dark: tone("#97966c", "#1e1e0b", "#28280f"),
  },
];

// Keyed on the id, so a circle keeps its colour as others come and go.
export function circleTone(circleId: string, scheme: Scheme): CircleTone {
  let hash = 0;
  for (const char of circleId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return circleTones[Math.abs(hash) % circleTones.length]![scheme];
}

export type Colors = {
  background: string;
  // Home sits on this, so its white sheet of circles reads as raised.
  homeBackground: string;
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
  dangerForeground: string;
  // The tomato of counters and the "now" line.
  accent: string;
  progressTrack: string;
  // Behind a dialog.
  overlay: string;
};

// Muted text and danger stay at or above 4.5:1 on their backgrounds.
const palette: Record<Scheme, Colors> = {
  light: {
    background: "#ffffff",
    homeBackground: "#e4e4df",
    card: "#ffffff",
    sheet: "#ffffff",
    surface: "#f5f5f5",
    control: "#ffffff",
    foreground: "#0a0a0a",
    primary: "#0a0a0a",
    primaryForeground: "#ffffff",
    muted: "#f5f5f5",
    textMuted: "#5e5e58",
    border: "#e5e5e5",
    input: "rgba(10,10,10,0.18)",
    danger: "#c0392b",
    dangerForeground: "#ffffff",
    accent: "#d9532c",
    progressTrack: "rgba(10,10,10,0.2)",
    overlay: "rgba(10,10,10,0.45)",
  },
  dark: {
    background: "#141413",
    homeBackground: "#141413",
    card: "#1f1f1d",
    sheet: "#1f1f1d",
    surface: "#2a2a27",
    control: "#1f1f1d",
    foreground: "#f2f2ee",
    primary: "#f2f2ee",
    primaryForeground: "#0a0a0a",
    muted: "#2a2a27",
    textMuted: "#a3a39c",
    border: "rgba(242,242,238,0.14)",
    input: "#55554f",
    danger: "#f97066",
    dangerForeground: "#0a0a0a",
    accent: "#d9532c",
    progressTrack: "rgba(242,242,238,0.2)",
    overlay: "rgba(0,0,0,0.6)",
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
