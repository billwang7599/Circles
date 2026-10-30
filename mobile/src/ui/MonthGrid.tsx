import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "./Icon";
import { Text } from "./Text";
import { font, radius, space, typeScale, useTheme } from "./theme";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");

export type Month = { year: number; month: number };

export const dayKey = (year: number, month: number, day: number) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

// The month a YYYY-MM-DD day falls in.
export function monthOf(date: string): Month {
  const [year, month] = date.split("-").map(Number) as [number, number];
  return { year, month: month - 1 };
}

export function addMonths({ year, month }: Month, by: number): Month {
  const date = new Date(Date.UTC(year, month + by, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

// The month's days, led by blanks so the 1st lands on its weekday.
function monthCells(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return [
    ...Array.from({ length: first }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
}

// "October ’26", the month written the way the calendar heads it.
export function monthTitle({ year, month }: Month) {
  const name = new Intl.DateTimeFormat(undefined, {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month, 1)));
  return `${name} ’${String(year).slice(2)}`;
}

export function MonthHeader({
  month,
  onMove,
  canGoBack = true,
  compact = false,
}: {
  month: Month;
  onMove: (by: number) => void;
  canGoBack?: boolean;
  // A smaller heading, for a calendar that sits inside a form.
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const arrow = compact ? styles.arrowCompact : styles.arrow;
  return (
    <View style={styles.monthRow}>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[compact ? typeScale.title : typeScale.display, styles.grow]}
      >
        {monthTitle(month)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        disabled={!canGoBack}
        onPress={() => onMove(-1)}
        style={({ pressed }) => [
          arrow,
          {
            borderColor: colors.primary,
            opacity: !canGoBack ? 0.3 : pressed ? 0.7 : 1,
          },
        ]}
      >
        <Icon
          name="arrow-left"
          size={compact ? 18 : 20}
          color={colors.foreground}
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next month"
        onPress={() => onMove(1)}
        style={({ pressed }) => [
          arrow,
          {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Icon
          name="arrow-right"
          size={compact ? 18 : 20}
          color={colors.primaryForeground}
        />
      </Pressable>
    </View>
  );
}

// Weekday heads over the month's days; each day draws itself.
export function MonthGrid({
  month,
  renderDay,
}: {
  month: Month;
  renderDay: (key: string, day: number) => ReactNode;
}) {
  return (
    <View style={styles.grid}>
      {WEEKDAYS.map((name) => (
        <View key={name} style={styles.cell}>
          <Text variant="button" style={styles.weekday}>
            {name}
          </Text>
        </View>
      ))}
      {monthCells(month.year, month.month).map((day, index) =>
        day === null ? (
          <View key={`blank${index}`} style={styles.cell} />
        ) : (
          <View key={day} style={styles.cell}>
            {renderDay(dayKey(month.year, month.month, day), day)}
          </View>
        ),
      )}
    </View>
  );
}

// A day's number in its round: filled when chosen, ringed for today.
export function DayNumber({
  day,
  filled = false,
  ringed = false,
  muted = false,
}: {
  day: number;
  filled?: boolean;
  ringed?: boolean;
  muted?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.number,
        filled
          ? { backgroundColor: colors.primary }
          : ringed
            ? { borderWidth: 1.5, borderColor: colors.primary }
            : null,
      ]}
    >
      <Text
        allowFontScaling={false}
        style={[
          styles.numberText,
          {
            color: filled
              ? colors.primaryForeground
              : muted
                ? colors.textMuted
                : colors.foreground,
            opacity: muted ? 0.45 : 1,
          },
        ]}
      >
        {day}
      </Text>
    </View>
  );
}

export const daySize = 42;

const styles = StyleSheet.create({
  monthRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  grow: { flex: 1 },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowCompact: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: space.xs },
  cell: { width: `${100 / 7}%`, alignItems: "center" },
  weekday: { fontFamily: font.medium },
  number: {
    width: daySize,
    height: daySize,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: {
    fontFamily: font.medium,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -1.2,
  },
});
