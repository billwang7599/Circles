import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { formatDay, todayKey } from "../dates";
import {
  addMonths,
  DayNumber,
  MonthGrid,
  MonthHeader,
  monthOf,
} from "../ui/MonthGrid";
import { IconButton } from "../ui/IconButton";
import { Text } from "../ui/Text";
import { radius, space } from "../ui/theme";
import { comingUp, needsYou, type AgendaItem } from "./agenda";
import { EventList } from "./EventRow";
import { PlanCard } from "./PlanCard";

// The month, then one area under it: the chosen day's plans, or what is coming
// up when no day is chosen. What needs me follows.
export function Calendar({ items }: { items: AgendaItem[] }) {
  const today = todayKey();
  const [selected, setSelected] = useState<string | null>(null);
  const [month, setMonth] = useState(() => monthOf(today));

  const byDay = new Map<string, AgendaItem[]>();
  for (const item of items)
    byDay.set(item.day, [...(byDay.get(item.day) ?? []), item]);
  const selectedItems = selected ? (byDay.get(selected) ?? []) : [];
  const waiting = needsYou(items);
  const ahead = comingUp(items);

  return (
    <View style={styles.events}>
      <View style={styles.month}>
        <MonthHeader
          large
          month={month}
          onMove={(by) => setMonth((current) => addMonths(current, by))}
        />
        <MonthGrid
          large
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
                onPress={() =>
                  setSelected((current) => (current === key ? null : key))
                }
                style={styles.cell}
              >
                <DayNumber
                  large
                  day={day}
                  filled={key === selected}
                  ringed={key === today}
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
      </View>

      {selected ? (
        <View style={styles.day}>
          <View style={styles.dayTitle}>
            <View style={styles.grow}>
              <Text color="textMuted">Selected day</Text>
              <Text variant="cardTitle">{formatDay(selected)}</Text>
            </View>
            <IconButton
              icon="xmark"
              label="Clear selected day"
              onPress={() => setSelected(null)}
            />
          </View>
          {selectedItems.length === 0 ? (
            <Text color="textMuted">Nothing planned</Text>
          ) : (
            <View>
              {selectedItems.map((item, index) => (
                <PlanCard
                  key={item.plan.id}
                  item={item}
                  stacked={index > 0}
                  covered={index < selectedItems.length - 1}
                />
              ))}
            </View>
          )}
        </View>
      ) : ahead.length > 0 ? (
        <EventList title="Coming up" items={ahead} />
      ) : waiting.length === 0 ? (
        <Text variant="strong">Nothing coming up</Text>
      ) : null}

      {waiting.length > 0 ? (
        <EventList title="Needs you" items={waiting} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  events: { gap: space.xxl, paddingHorizontal: space.gutter },
  month: { gap: space.gutter },
  cell: { alignSelf: "stretch", alignItems: "center", gap: 3, height: 46 },
  dots: { flexDirection: "row", gap: 2, height: 5 },
  dot: { width: 5, height: 5, borderRadius: radius.full },
  day: { gap: space.md },
  dayTitle: { flexDirection: "row", alignItems: "center", gap: space.sm },
  grow: { flex: 1 },
});
