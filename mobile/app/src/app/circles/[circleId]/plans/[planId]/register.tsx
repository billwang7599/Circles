import {
  datesIn,
  Part,
  PREFERENCES,
  RegistrationInput,
  type BusyPart,
  type PlanView,
  type PreferenceId,
} from "@circles/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { usePlan, useSaveRegistration } from "../../../../../api";
import { formatDate } from "../../../../../dates";
import { Button } from "../../../../../ui/Button";
import { Chip } from "../../../../../ui/Chip";
import { Field } from "../../../../../ui/Field";
import { Screen } from "../../../../../ui/Screen";
import { Text } from "../../../../../ui/Text";
import { space } from "../../../../../ui/theme";

const partLabels: Record<Part, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

export default function Register() {
  const { circleId, planId } = useLocalSearchParams<{
    circleId: string;
    planId: string;
  }>();
  const plan = usePlan(circleId, planId);
  return (
    <Screen>
      {plan.isPending ? (
        <ActivityIndicator />
      ) : plan.isError ? (
        <Text color="danger">{plan.error.message}</Text>
      ) : (
        <Form circleId={circleId} planId={planId} view={plan.data} />
      )}
    </Screen>
  );
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
  const [issues, setIssues] = useState<
    { path: PropertyKey[]; message: string }[]
  >([]);
  const save = useSaveRegistration(circleId, planId);
  const dates = datesIn(view.plan.windowStart, view.plan.windowEnd);
  const issue = (field: string) =>
    issues.find((i) => i.path[0] === field)?.message;
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
    const dollars = Number(budget);
    const budgetCents =
      budget.trim() !== "" && Number.isFinite(dollars)
        ? Math.round(dollars * 100)
        : undefined;
    const parsed = RegistrationInput.safeParse({
      attending: true,
      budgetCents,
      busy,
      preferences,
    });
    setIssues(parsed.success ? [] : parsed.error.issues);
    if (parsed.success) {
      save.mutate(parsed.data, {
        onSuccess: () =>
          router.dismissTo(`/circles/${circleId}/plans/${planId}`),
      });
    }
  }

  return (
    <>
      <View style={styles.fields}>
        <Field
          label="Budget per person"
          icon="lock"
          value={budget}
          onChangeText={setBudget}
          error={issue("budgetCents")}
          keyboardType="decimal-pad"
          inputMode="decimal"
        />
        <View style={styles.field}>
          <Text variant="label">Busy times</Text>
          {dates.map((date) => (
            <View key={date} style={styles.day}>
              <Text>{formatDate(date, true)}</Text>
              <View style={styles.chips}>
                {Part.options.map((part) => (
                  <Chip
                    key={part}
                    label={partLabels[part]}
                    selected={isBusy(date, part)}
                    onPress={() => toggleBusy(date, part)}
                  />
                ))}
              </View>
            </View>
          ))}
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
      {save.error ? <Text color="danger">{save.error.message}</Text> : null}
      <Button title="Save" onPress={submit} loading={save.isPending} />
    </>
  );
}

const styles = StyleSheet.create({
  fields: { gap: space.lg },
  field: { gap: space.sm },
  day: { gap: space.sm, paddingTop: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
