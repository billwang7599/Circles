import {
  addDays,
  daysBetween,
  localDate,
  maxWindowDays,
  Preset,
  presetWindow,
} from "@circles/shared";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { formatDay, formatRange, useNow } from "../dates";
import { Chip } from "../ui/Chip";
import {
  addMonths,
  DayNumber,
  daySize,
  MonthGrid,
  MonthHeader,
  monthOf,
} from "../ui/MonthGrid";
import { Text } from "../ui/Text";
import { space, useTheme } from "../ui/theme";

export type DateWindow = { windowStart: string; windowEnd: string };

const presetLabels: Record<Preset, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  weekend: "This weekend",
  week: "This week",
  twoWeeks: "Next 2 weeks",
};

// A first tap picks the start, the next one the end; presets fill both.
export function DateRangePicker({
  value,
  timezone,
  onChange,
  error,
}: {
  value: DateWindow;
  // The area's, so "today" is the plan's today.
  timezone: string;
  onChange: (value: DateWindow) => void;
  error?: string;
}) {
  const { colors } = useTheme();
  const now = useNow();
  const today = localDate(new Date(now), timezone);
  const [month, setMonth] = useState(() => monthOf(value.windowStart));
  // Between the start's tap and the end's.
  const [picking, setPicking] = useState(false);
  const { windowStart: start, windowEnd: end } = value;
  const lastDay = picking ? addDays(start, maxWindowDays) : undefined;
  const firstMonth = monthOf(today);
  const canGoBack =
    month.year > firstMonth.year ||
    (month.year === firstMonth.year && month.month > firstMonth.month);

  function choosePreset(preset: Preset) {
    const next = presetWindow(preset, timezone, new Date());
    onChange(next);
    setPicking(false);
    setMonth(monthOf(next.windowStart));
  }

  function tap(day: string) {
    if (picking && day >= start) {
      onChange({ windowStart: start, windowEnd: day });
      setPicking(false);
    } else {
      onChange({ windowStart: day, windowEnd: day });
      setPicking(true);
    }
  }

  const days = daysBetween(start, end) + 1;

  return (
    <View style={styles.picker}>
      <View style={styles.chips}>
        {Preset.options.map((preset) => {
          const window = presetWindow(preset, timezone, new Date(now));
          return (
            <Chip
              key={preset}
              label={presetLabels[preset]}
              selected={
                !picking &&
                window.windowStart === start &&
                window.windowEnd === end
              }
              onPress={() => choosePreset(preset)}
            />
          );
        })}
      </View>

      <MonthHeader
        compact
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
          const inRange = key >= start && key <= end;
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

      <View style={styles.summary}>
        <Text variant="headline">{formatRange(start, end)}</Text>
        <Text color={error ? "danger" : "textMuted"}>
          {error ??
            (picking
              ? "Tap the last day, up to two weeks on"
              : days === 1
                ? "1 day"
                : `${days} days`)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: space.lg },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  day: { alignSelf: "stretch", alignItems: "center" },
  band: { position: "absolute", top: 0, height: daySize },
  summary: { gap: 2 },
});
