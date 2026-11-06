import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, type IconName } from "./Icon";
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
  large = false,
}: {
  month: Month;
  onMove: (by: number) => void;
  canGoBack?: boolean;
  // A smaller heading, for a calendar that sits inside a form.
  compact?: boolean;
  // The heading that opens the Calendar tab, with filled arrows.
  large?: boolean;
}) {
  const { colors } = useTheme();
  const arrow = compact ? styles.arrowCompact : styles.arrow;
  if (large)
    return (
      <View style={styles.monthRow}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          adjustsFontSizeToFit
          variant="month"
          style={styles.grow}
        >
          {monthTitle(month)}
        </Text>
        <LargeArrow
          icon="arrow-left"
          label="Previous month"
          onPress={() => onMove(-1)}
        />
        <LargeArrow
          icon="arrow-right"
          label="Next month"
          onPress={() => onMove(1)}
        />
      </View>
    );
  return (
    <View style={styles.monthRow}>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[compact ? typeScale.heading : typeScale.title, styles.grow]}
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
            borderColor: colors.input,
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
            borderColor: colors.input,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Icon
          name="arrow-right"
          size={compact ? 18 : 20}
          color={colors.foreground}
        />
      </Pressable>
    </View>
  );
}

function LargeArrow({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={space.xs}
      onPress={onPress}
      style={({ pressed }) => [
        styles.largeArrow,
        { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Icon name={icon} size={16} color={colors.primaryForeground} />
    </Pressable>
  );
}

// Weekday heads over the month's days; each day draws itself.
export function MonthGrid({
  month,
  renderDay,
  large = false,
}: {
  month: Month;
  renderDay: (key: string, day: number) => ReactNode;
  // Whole weekday names, for the calendar that opens the Calendar tab.
  large?: boolean;
}) {
  return (
    <View style={[styles.grid, large && styles.largeGrid]}>
      {WEEKDAYS.map((name) => (
        <View key={name} style={styles.cell}>
          {large ? (
            <Text style={styles.largeWeekday}>{name}</Text>
          ) : (
            <Text variant="body" color="textMuted" style={styles.weekday}>
              {name.slice(0, 1)}
            </Text>
          )}
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

// A day's number in its round: filled when chosen, ringed dark for today,
// faintly ringed otherwise, and bare when it cannot be picked.
export function DayNumber({
  day,
  filled = false,
  ringed = false,
  muted = false,
  large = false,
}: {
  day: number;
  filled?: boolean;
  ringed?: boolean;
  muted?: boolean;
  // A bigger number in a tighter round, bare unless chosen or today.
  large?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        large ? styles.largeNumber : styles.number,
        filled
          ? { backgroundColor: colors.primary }
          : ringed
            ? { borderWidth: large ? 1.5 : 2, borderColor: colors.primary }
            : muted || large
              ? null
              : { borderWidth: 1, borderColor: colors.border },
      ]}
    >
      <Text
        allowFontScaling={false}
        style={[
          large ? styles.largeNumberText : styles.numberText,
          large && filled && styles.largeNumberFilled,
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
    width: 48,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1.2,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowCompact: {
    width: 44,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1.2,
    alignItems: "center",
    justifyContent: "center",
  },
  largeArrow: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: space.xs },
  largeGrid: { rowGap: space.md },
  largeWeekday: {
    fontFamily: font.semibold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.28,
  },
  cell: { width: `${100 / 7}%`, alignItems: "center" },
  weekday: { paddingBottom: space.xs },
  number: {
    width: daySize,
    height: daySize,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  largeNumber: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  largeNumberText: {
    fontFamily: font.medium,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.84,
  },
  largeNumberFilled: { fontFamily: font.bold },
  numberText: {
    fontFamily: font.regular,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.4,
  },
});
