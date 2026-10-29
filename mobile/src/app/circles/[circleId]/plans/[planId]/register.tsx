import {
  datesIn,
  Part,
  PREFERENCES,
  RegistrationInput,
  sameRegistration,
  type BusyPart,
  type PlanView,
  type PreferenceId,
} from "@circles/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { isRefusal, usePlan, useSaveRegistration } from "../../../../../api";
import { confirmAction } from "../../../../../confirm";
import { formatDate } from "../../../../../dates";
import { Button } from "../../../../../ui/Button";
import { Chip } from "../../../../../ui/Chip";
import { ErrorState } from "../../../../../ui/ErrorState";
import { Field, useIssues } from "../../../../../ui/Field";
import { Icon } from "../../../../../ui/Icon";
import { Screen } from "../../../../../ui/Screen";
import { MetaItem, ScreenTitle } from "../../../../../ui/ScreenTitle";
import { StatusBadge } from "../../../../../ui/StatusBadge";
import { Text } from "../../../../../ui/Text";
import { radius, size, space, useTheme } from "../../../../../ui/theme";

const partLabels: Record<Part, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

const cellWidth = 64;

// "30", "$30.50", "1,000" and "30,50" all read as dollars: a comma groups
// thousands when exactly three digits follow it, otherwise it is a decimal point.
function parseDollars(text: string): number | undefined {
  const digits = text.replace(/[^0-9.,]/g, "");
  if (digits === "") return undefined;
  const normalized =
    digits.includes(".") || /^\d{1,3}(,\d{3})+$/.test(digits)
      ? digits.replace(/,/g, "")
      : digits.replace(",", ".");
  const dollars = Number(normalized);
  return Number.isFinite(dollars) ? Math.round(dollars * 100) : undefined;
}

export default function Register() {
  const { circleId, planId } = useLocalSearchParams<{
    circleId: string;
    planId: string;
  }>();
  const plan = usePlan(circleId, planId);
  if (!plan.data || isRefusal(plan.error))
    return (
      <Screen>
        {plan.isError ? (
          <ErrorState
            message={plan.error.message}
            onRetry={() => plan.refetch()}
          />
        ) : (
          <ActivityIndicator />
        )}
      </Screen>
    );
  return <Form circleId={circleId} planId={planId} view={plan.data} />;
}

function Form({
  circleId,
  planId,
  view,
}: {
  circleId: string;
  planId: string;
  view: PlanView;
}) {
  const { registration, defaults } = view.me;
  const initialCents = registration?.budgetCents ?? defaults.budgetCents;
  const [budget, setBudget] = useState(
    initialCents === undefined ? "" : (initialCents / 100).toFixed(2),
  );
  const [busy, setBusy] = useState<BusyPart[]>(registration?.busy ?? []);
  const [preferences, setPreferences] = useState<PreferenceId[]>(
    registration?.preferences ?? defaults.preferences,
  );
  const { issue, setIssues } = useIssues();
  const save = useSaveRegistration(circleId, planId);
  const dates = datesIn(view.plan.windowStart, view.plan.windowEnd);
  const isBusy = (date: string, part: Part) =>
    busy.some((b) => b.date === date && b.part === part);

  function toggleBusy(date: string, part: Part) {
    setBusy((current) =>
      current.some((b) => b.date === date && b.part === part)
        ? current.filter((b) => b.date !== date || b.part !== part)
        : [...current, { date, part }],
    );
  }

  function togglePreference(id: PreferenceId) {
    setPreferences((current) =>
      current.includes(id) ? current.filter((p) => p !== id) : [...current, id],
    );
  }

  function submit() {
    const parsed = RegistrationInput.safeParse({
      attending: true,
      budgetCents: parseDollars(budget),
      // The window may have moved since the form opened; only dates in it count.
      busy: busy.filter((b) => dates.includes(b.date)),
      preferences,
    });
    setIssues(parsed.success ? [] : parsed.error.issues);
    if (!parsed.success) return;
    const run = () =>
      save.mutate(parsed.data, {
        onSuccess: () =>
          router.dismissTo(`/circles/${circleId}/plans/${planId}`),
      });
    // Changed answers make the current options stale.
    if (view.options.length > 0 && !sameRegistration(parsed.data, registration))
      confirmAction(
        "Save",
        "Current options will need a refresh, which clears votes.",
        "Save",
        run,
      );
    else run();
  }

  // The plan can lock or end while this form is open; the poll tells us.
  const closed = view.plan.phase.kind !== "open";

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          {save.error ? (
            <Text color="danger">{save.error.message}</Text>
          ) : closed ? (
            <StatusBadge phase={view.plan.phase} />
          ) : null}
          <Button
            title="Save"
            onPress={submit}
            loading={save.isPending}
            disabled={closed}
          />
        </View>
      }
    >
      <ScreenTitle title="Budget and times">
        <MetaItem icon="calendar" text={view.plan.title} />
        <MetaItem icon="users" text={view.plan.circle.name} />
      </ScreenTitle>
      <View style={styles.fields}>
        <Field
          label="Your budget"
          icon="lock"
          prefix="$"
          accessibilityLabel="Your budget, only you can see it"
          value={budget}
          onChangeText={setBudget}
          error={issue("budgetCents")}
          keyboardType="decimal-pad"
          inputMode="decimal"
        />
        <View style={styles.field}>
          <Text variant="label">Busy times</Text>
          <BusyGrid dates={dates} isBusy={isBusy} onToggle={toggleBusy} />
        </View>
        <View style={styles.field}>
          <Text variant="label">Preferences</Text>
          <View style={styles.chips}>
            {PREFERENCES.map((preference) => (
              <Chip
                key={preference.id}
                label={preference.label}
                selected={preferences.includes(preference.id)}
                onPress={() => togglePreference(preference.id)}
              />
            ))}
          </View>
        </View>
      </View>
    </Screen>
  );
}

function BusyGrid({
  dates,
  isBusy,
  onToggle,
}: {
  dates: string[];
  isBusy: (date: string, part: Part) => boolean;
  onToggle: (date: string, part: Part) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      <View style={styles.gridRow}>
        <View style={styles.day} />
        {Part.options.map((part) => (
          <Text
            key={part}
            variant="caption"
            color="textMuted"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={styles.cellHeader}
          >
            {partLabels[part]}
          </Text>
        ))}
      </View>
      {dates.map((date) => {
        const day = formatDate(date, true);
        return (
          <View key={date} style={styles.gridRow}>
            <Text numberOfLines={2} style={styles.day}>
              {day}
            </Text>
            {Part.options.map((part) => {
              const checked = isBusy(date, part);
              return (
                <Pressable
                  key={part}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  accessibilityLabel={`${day} ${partLabels[part].toLowerCase()}`}
                  hitSlop={space.xs}
                  onPress={() => onToggle(date, part)}
                  style={({ pressed }) => [
                    styles.cell,
                    {
                      backgroundColor: checked
                        ? colors.primary
                        : colors.control,
                      borderColor: checked ? colors.primary : colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  {checked ? (
                    <Icon
                      name="xmark"
                      size={18}
                      color={colors.primaryForeground}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: space.xl },
  field: { gap: space.sm },
  grid: { gap: space.sm },
  gridRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  day: { flex: 1 },
  cellHeader: { width: cellWidth, textAlign: "center" },
  cell: {
    width: cellWidth,
    height: size.small,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  footer: { flex: 1, gap: space.sm },
});
