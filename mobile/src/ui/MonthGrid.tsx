import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { radius, size, space, useTheme } from "./theme";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");

export type Month = { year: number; month: number };

const dayKey = (year: number, month: number, day: number) =>
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
function monthTitle({ year, month }: Month) {
  const name = new Intl.DateTimeFormat(undefined, {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month, 1)));
  return `${name} ’${String(year).slice(2)}`;
}

function Arrow({
  icon,
  label,
  disabled = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.arrow,
        {
          borderColor: colors.input,
          opacity: disabled ? 0.3 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Icon name={icon} size={18} color={colors.foreground} />
    </Pressable>
  );
}

// The month's name with an outlined arrow either way.
export function MonthHeader({
  month,
  onMove,
  canGoBack = true,
}: {
  month: Month;
  onMove: (by: number) => void;
  canGoBack?: boolean;
}) {
  return (
    <View style={styles.monthRow}>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        adjustsFontSizeToFit
        variant="heading"
        style={styles.grow}
      >
        {monthTitle(month)}
      </Text>
      <Arrow
        icon="arrow-left"
        label="Previous month"
        disabled={!canGoBack}
        onPress={() => onMove(-1)}
      />
      <Arrow icon="arrow-right" label="Next month" onPress={() => onMove(1)} />
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
          <Text variant="body" color="textMuted" style={styles.weekday}>
            {name.slice(0, 1)}
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

// A day's number in its round: filled when chosen, ringed dark for today,
// faintly ringed otherwise, and bare when it cannot be picked.
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
            ? { borderWidth: 2, borderColor: colors.primary }
            : muted
              ? null
              : { borderWidth: 1, borderColor: colors.border },
      ]}
    >
      <Text
        allowFontScaling={false}
        variant="input"
        style={{
          color: filled
            ? colors.primaryForeground
            : muted
              ? colors.textMuted
              : colors.foreground,
          opacity: muted ? 0.45 : 1,
        }}
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
    width: size.control,
    height: size.small,
    borderRadius: radius.full,
    borderWidth: 1.2,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: space.xs },
  cell: { width: `${100 / 7}%`, alignItems: "center" },
  weekday: { paddingBottom: space.xs },
  number: {
    width: daySize,
    height: daySize,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
