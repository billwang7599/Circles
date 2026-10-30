import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { formatDay } from "../dates";
import { Icon } from "../ui/Icon";
import { Text } from "../ui/Text";
import { font, radius, space, typeScale, useTheme } from "../ui/theme";
import type { AgendaItem } from "./agenda";
import { PlanCard } from "./PlanCard";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (year: number, month: number, day: number) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

function today() {
  const now = new Date();
  return dayKey(now.getFullYear(), now.getMonth(), now.getDate());
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

export function Calendar({ items }: { items: AgendaItem[] }) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => {
    const [year, m] = selected.split("-").map(Number) as [number, number];
    return { year, month: m - 1 };
  });

  const byDay = new Map<string, AgendaItem[]>();
  for (const item of items)
    byDay.set(item.day, [...(byDay.get(item.day) ?? []), item]);
  const selectedItems = byDay.get(selected) ?? [];
  const todayKey = today();

  function move(by: number) {
    const date = new Date(Date.UTC(month.year, month.month + by, 1));
    setMonth({ year: date.getUTCFullYear(), month: date.getUTCMonth() });
  }

  const title = new Intl.DateTimeFormat(undefined, {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(month.year, month.month, 1)));

  return (
    <View style={styles.calendar}>
      <View style={styles.monthRow}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[typeScale.display, styles.grow]}
        >
          {title} ’{String(month.year).slice(2)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => move(-1)}
          style={({ pressed }) => [
            styles.arrow,
            { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Icon name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() => move(1)}
          style={({ pressed }) => [
            styles.arrow,
            {
              backgroundColor: colors.primary,
              borderColor: colors.primary,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Icon name="arrow-right" size={20} color={colors.primaryForeground} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {WEEKDAYS.map((name) => (
          <View key={name} style={styles.cell}>
            <Text variant="button" style={styles.weekday}>
              {name}
            </Text>
          </View>
        ))}
        {monthCells(month.year, month.month).map((day, index) => {
          if (day === null)
            return <View key={`blank${index}`} style={styles.cell} />;
          const key = dayKey(month.year, month.month, day);
          const isSelected = key === selected;
          const isToday = key === todayKey;
          const dayItems = byDay.get(key) ?? [];
          const tones = [
            ...new Map(
              dayItems.map((item) => [item.tone.fill, item.tone]),
            ).values(),
          ].slice(0, 3);
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              aria-selected={isSelected}
              accessibilityLabel={`${formatDay(key)}${
                dayItems.length ? `, ${dayItems.length} plans` : ""
              }`}
              onPress={() => setSelected(key)}
              style={styles.cell}
            >
              <View
                style={[
                  styles.number,
                  isSelected
                    ? { backgroundColor: colors.primary }
                    : isToday
                      ? { borderWidth: 1.5, borderColor: colors.primary }
                      : null,
                ]}
              >
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.numberText,
                    {
                      color: isSelected
                        ? colors.primaryForeground
                        : colors.foreground,
                    },
                  ]}
                >
                  {day}
                </Text>
              </View>
              <View style={styles.dots}>
                {tones.map((tone) => (
                  <View
                    key={tone.fill}
                    style={[styles.dot, { backgroundColor: tone.fill }]}
                  />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.day}>
        <Text variant="headline" style={styles.dayTitle}>
          {formatDay(selected)}
        </Text>
        {selectedItems.length === 0 ? (
          <Text color="textMuted">Nothing planned</Text>
        ) : (
          selectedItems.map((item) => (
            <PlanCard key={item.plan.id} item={item} />
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { gap: space.xl, paddingHorizontal: space.gutter },
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
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: space.xs },
  cell: { width: `${100 / 7}%`, alignItems: "center", gap: 3 },
  weekday: { fontFamily: font.medium },
  number: {
    width: 42,
    height: 42,
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
  dots: { flexDirection: "row", gap: 3, height: 8 },
  dot: { width: 8, height: 8, borderRadius: radius.full },
  day: { gap: space.md },
  dayTitle: { fontFamily: font.medium },
});
