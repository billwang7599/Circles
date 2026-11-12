import { iso, lastDayOf, weekdayOf, ymd } from "@circles/shared";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { RoundButton } from "./RoundButton";
import { Text } from "./Text";
import { radius, size, space, useTheme } from "./theme";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// A calendar month; `month` is 1 to 12, as the shared date helpers count.
export type Month = { year: number; month: number };

// The month a YYYY-MM-DD day falls in.
export function monthOf(date: string): Month {
  const { year, month } = ymd(date);
  return { year, month };
}

export function addMonths({ year, month }: Month, by: number): Month {
  return monthOf(iso(year, month + by, 1));
}

// The month's days as weeks of seven, blanks before the 1st and after the
// last so every row has a cell per column.
function weeksOf({ year, month }: Month): (number | null)[][] {
  const first = weekdayOf(iso(year, month, 1));
  const days = lastDayOf(year, month);
  const cells: (number | null)[] = [
    ...Array.from({ length: first }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let at = 0; at < cells.length; at += 7)
    weeks.push(cells.slice(at, at + 7));
  return weeks;
}

// "October ’26", the month written the way the calendar heads it.
function monthTitle({ year, month }: Month) {
  const name = new Intl.DateTimeFormat(undefined, {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return `${name} ’${String(year).slice(2)}`;
}

// The month's name with a round button either way.
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
      <RoundButton
        icon="arrow-left"
        label="Previous month"
        disabled={!canGoBack}
        onPress={() => onMove(-1)}
      />
      <RoundButton
        icon="arrow-right"
        label="Next month"
        onPress={() => onMove(1)}
      />
    </View>
  );
}

// Weekday heads over the month's days, a row per week with a cell per
// column; each day draws itself.
export function MonthGrid({
  month,
  renderDay,
}: {
  month: Month;
  renderDay: (key: string, day: number) => ReactNode;
}) {
  return (
    <View style={styles.grid}>
      <View style={styles.week}>
        {WEEKDAYS.map((name) => (
          <View key={name} style={styles.cell}>
            <Text
              variant="body"
              color="textMuted"
              accessibilityLabel={name}
              style={styles.weekday}
            >
              {name.slice(0, 1)}
            </Text>
          </View>
        ))}
      </View>
      {weeksOf(month).map((week, row) => (
        <View key={row} style={styles.week}>
          {week.map((day, column) =>
            day === null ? (
              <View key={`blank${column}`} style={styles.cell} />
            ) : (
              <View key={day} style={styles.cell}>
                {renderDay(iso(month.year, month.month, day), day)}
              </View>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

// A day's number: filled in ink when chosen, ringed for today, faint when
// it cannot be picked, bare otherwise.
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
            : null,
      ]}
    >
      <Text
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

export const daySize = size.control;

const styles = StyleSheet.create({
  monthRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  grow: { flex: 1 },
  grid: { gap: space.xs },
  week: { flexDirection: "row" },
  cell: { flex: 1, alignItems: "center" },
  weekday: { paddingBottom: space.xs },
  number: {
    width: daySize,
    height: daySize,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
