import { addDays, maxWindowDays, type DateWindow } from "@circles/shared";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { formatDay } from "../dates";
import {
  addMonths,
  DayNumber,
  daySize,
  MonthGrid,
  MonthHeader,
  monthOf,
} from "../ui/MonthGrid";
import { space, useTheme } from "../ui/theme";

// A first tap picks the start, the next one the end.
export function DateRangePicker({
  value,
  today,
  onChange,
}: {
  value?: DateWindow;
  // The organizer's calendar day, so earlier days cannot be picked.
  today: string;
  onChange: (value: DateWindow) => void;
}) {
  const { colors } = useTheme();
  const [month, setMonth] = useState(() =>
    monthOf(value?.windowStart ?? today),
  );
  // Between the start's tap and the end's.
  const [picking, setPicking] = useState(false);
  const start = value?.windowStart;
  const end = value?.windowEnd;
  const lastDay = picking && start ? addDays(start, maxWindowDays) : undefined;
  const firstMonth = monthOf(today);
  const canGoBack =
    month.year > firstMonth.year ||
    (month.year === firstMonth.year && month.month > firstMonth.month);

  function tap(day: string) {
    if (picking && start && day >= start) {
      onChange({ windowStart: start, windowEnd: day });
      setPicking(false);
    } else {
      onChange({ windowStart: day, windowEnd: day });
      setPicking(true);
    }
  }

  return (
    <View style={styles.picker}>
      <MonthHeader
        month={month}
        canGoBack={canGoBack}
        onMove={(by) => setMonth((current) => addMonths(current, by))}
      />
      <MonthGrid
        month={month}
        renderDay={(key, day) => {
          const disabled =
            key < today || (lastDay !== undefined && key > lastDay);
          const isStart = key === start;
          const isEnd = key === end;
          const inRange =
            start !== undefined &&
            end !== undefined &&
            key >= start &&
            key <= end;
          return (
            <Pressable
              accessibilityRole="button"
              aria-selected={inRange}
              accessibilityState={{ disabled }}
              accessibilityLabel={`${formatDay(key)}${
                isStart && isEnd
                  ? ""
                  : isStart
                    ? ", first day"
                    : isEnd
                      ? ", last day"
                      : ""
              }`}
              disabled={disabled}
              onPress={() => tap(key)}
              style={styles.day}
            >
              {inRange && start !== end ? (
                <View
                  style={[
                    styles.band,
                    {
                      backgroundColor: colors.surface,
                      left: isStart ? "50%" : 0,
                      right: isEnd ? "50%" : 0,
                    },
                  ]}
                />
              ) : null}
              <DayNumber
                day={day}
                filled={isStart || isEnd}
                ringed={key === today}
                muted={disabled}
              />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: space.md },
  day: { alignSelf: "stretch", alignItems: "center" },
  band: { position: "absolute", top: 0, height: daySize },
});
