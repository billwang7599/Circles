import {
  AvailabilityPart,
  BUDGET_RUNGS,
  Defaults as DefaultsSchema,
  maxVibes,
  VIBE_LABELS,
  Vibe,
  Weekday,
  type BudgetRung,
  type Defaults,
  type FreeSlot,
} from "@circles/shared";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useDefaults, useSaveDefaults } from "../api";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { ErrorState } from "../ui/ErrorState";
import { Icon, type IconName } from "../ui/Icon";
import { Screen } from "../ui/Screen";
import { Segmented } from "../ui/Segmented";
import { Text } from "../ui/Text";
import { radius, size, space, useTheme } from "../ui/theme";

const dayLabels: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const partLabels: Record<AvailabilityPart, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  late: "Late",
};

const rungRows = [BUDGET_RUNGS.slice(0, 3), BUDGET_RUNGS.slice(3)];

// Answers given in any order are the same answers.
const fingerprint = ({ budget, availability, likes, dislikes }: Defaults) =>
  JSON.stringify([
    budget,
    availability.map((slot) => `${slot.day} ${slot.part}`).sort(),
    [...likes].sort(),
    [...dislikes].sort(),
  ]);

export default function DefaultsScreen() {
  const defaults = useDefaults();
  if (!defaults.data)
    return (
      <Screen>
        {defaults.isError ? (
          <ErrorState
            message={defaults.error.message}
            onRetry={() => defaults.refetch()}
          />
        ) : (
          <ActivityIndicator />
        )}
      </Screen>
    );
  return <Form saved={defaults.data} />;
}

function Form({ saved }: { saved: Defaults }) {
  const { colors } = useTheme();
  const [budget, setBudget] = useState<BudgetRung | null>(saved.budget);
  const [availability, setAvailability] = useState(saved.availability);
  const [likes, setLikes] = useState(saved.likes);
  const [dislikes, setDislikes] = useState(saved.dislikes);
  const save = useSaveDefaults();
  const draft: Defaults = { budget, availability, likes, dislikes };
  const changed = fingerprint(draft) !== fingerprint(saved);

  function toggleSlot({ day, part }: FreeSlot) {
    setAvailability((current) =>
      current.some((slot) => slot.day === day && slot.part === part)
        ? current.filter((slot) => slot.day !== day || slot.part !== part)
        : [...current, { day, part }],
    );
  }

  function submit() {
    const parsed = DefaultsSchema.safeParse(draft);
    if (parsed.success)
      save.mutate(parsed.data, { onSuccess: () => router.back() });
  }

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          {save.error ? <Text color="danger">{save.error.message}</Text> : null}
          <Button
            title="Save defaults"
            onPress={submit}
            disabled={!changed}
            loading={save.isPending}
          />
        </View>
      }
    >
      <View style={styles.sections}>
        <View style={styles.section}>
          <Text variant="fieldLabel" accessibilityRole="header">
            Budget
          </Text>
          {rungRows.map((rungs) => (
            <Segmented
              key={rungs[0]!.id}
              options={rungs}
              value={budget}
              onChange={setBudget}
            />
          ))}
        </View>

        <View style={styles.section}>
          <Text variant="fieldLabel" accessibilityRole="header">
            Availability
          </Text>
          <View style={styles.week}>
            <View style={styles.weekRow}>
              <View style={styles.gutter} />
              {AvailabilityPart.options.map((part) => (
                <Text
                  key={part}
                  variant="caption"
                  color="textMuted"
                  numberOfLines={1}
                  style={styles.partHead}
                >
                  {partLabels[part]}
                </Text>
              ))}
            </View>
            {Weekday.options.map((day) => (
              <View key={day} style={styles.weekRow}>
                <Text color="textMuted" style={styles.gutter}>
                  {dayLabels[day]}
                </Text>
                {AvailabilityPart.options.map((part) => {
                  const free = availability.some(
                    (slot) => slot.day === day && slot.part === part,
                  );
                  return (
                    <Pressable
                      key={part}
                      accessibilityRole="checkbox"
                      accessibilityLabel={`${dayLabels[day]} ${partLabels[part]}`}
                      aria-checked={free}
                      onPress={() => toggleSlot({ day, part })}
                      style={({ pressed }) => [
                        styles.slot,
                        {
                          backgroundColor: free
                            ? colors.primary
                            : "transparent",
                          borderColor: free ? colors.primary : colors.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      {free ? (
                        <Icon
                          name="check"
                          size={18}
                          color={colors.primaryForeground}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        <Vibes
          title="Likes"
          icon="heart"
          picked={likes}
          other={dislikes}
          onChange={setLikes}
        />
        <Vibes
          title="Dislikes"
          icon="ban"
          picked={dislikes}
          other={likes}
          onChange={setDislikes}
        />
      </View>
    </Screen>
  );
}

// A tag already in the other list, or past the limit, can't be picked.
function Vibes({
  title,
  icon,
  picked,
  other,
  onChange,
}: {
  title: string;
  icon: IconName;
  picked: Vibe[];
  other: Vibe[];
  onChange: (vibes: Vibe[]) => void;
}) {
  const { colors } = useTheme();
  const full = picked.length >= maxVibes;
  return (
    <View style={styles.vibes}>
      <View style={styles.vibesTitle}>
        <Icon name={icon} size={16} color={colors.foreground} />
        <Text variant="fieldLabel" accessibilityRole="header">
          {title}
        </Text>
      </View>
      <View style={styles.tags}>
        {Vibe.options.map((vibe) => {
          const selected = picked.includes(vibe);
          return (
            <Chip
              key={vibe}
              tag
              label={VIBE_LABELS[vibe]}
              selected={selected}
              disabled={!selected && (full || other.includes(vibe))}
              onPress={() =>
                onChange(
                  selected
                    ? picked.filter((item) => item !== vibe)
                    : [...picked, vibe],
                )
              }
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sections: { gap: space.xxl },
  section: { gap: space.md },
  week: { gap: space.inline },
  weekRow: { flexDirection: "row", alignItems: "center", gap: space.inline },
  gutter: { width: size.control },
  partHead: { flex: 1, textAlign: "center" },
  slot: {
    flex: 1,
    height: size.control,
    borderWidth: 1,
    borderRadius: radius.cell,
    alignItems: "center",
    justifyContent: "center",
  },
  vibes: { gap: space.sm },
  vibesTitle: { flexDirection: "row", alignItems: "center", gap: space.sm },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  footer: { flex: 1, gap: space.sm },
});
