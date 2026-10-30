import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { formatDay } from "../dates";
import {
  addMonths,
  DayNumber,
  dayKey,
  MonthGrid,
  MonthHeader,
  monthOf,
} from "../ui/MonthGrid";
import { Text } from "../ui/Text";
import { font, radius, space } from "../ui/theme";
import type { AgendaItem } from "./agenda";
import { PlanCard } from "./PlanCard";

function today() {
  const now = new Date();
  return dayKey(now.getFullYear(), now.getMonth(), now.getDate());
}

export function Calendar({ items }: { items: AgendaItem[] }) {
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => monthOf(selected));

  const byDay = new Map<string, AgendaItem[]>();
  for (const item of items)
    byDay.set(item.day, [...(byDay.get(item.day) ?? []), item]);
  const selectedItems = byDay.get(selected) ?? [];
  const todayKey = today();

  return (
    <View style={styles.calendar}>
      <MonthHeader
        month={month}
        onMove={(by) => setMonth((current) => addMonths(current, by))}
      />

      <MonthGrid
        month={month}
        renderDay={(key, day) => {
          const dayItems = byDay.get(key) ?? [];
          const tones = [
            ...new Map(
              dayItems.map((item) => [item.tone.fill, item.tone]),
            ).values(),
          ].slice(0, 3);
          return (
            <Pressable
              accessibilityRole="button"
              aria-selected={key === selected}
              accessibilityLabel={`${formatDay(key)}${
                dayItems.length ? `, ${dayItems.length} plans` : ""
              }`}
              onPress={() => setSelected(key)}
              style={styles.cell}
            >
              <DayNumber
                day={day}
                filled={key === selected}
                ringed={key === todayKey}
              />
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
        }}
      />

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
  cell: { alignSelf: "stretch", alignItems: "center", gap: 3 },
  dots: { flexDirection: "row", gap: 3, height: 8 },
  dot: { width: 8, height: 8, borderRadius: radius.full },
  day: { gap: space.md },
  dayTitle: { fontFamily: font.medium },
});
