import { AREAS, EditPlan, When, type AreaId } from "@circles/shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { formatWindow } from "../dates";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { Field, useIssues } from "../ui/Field";
import { Text } from "../ui/Text";
import { space } from "../ui/theme";

const whenLabels: Record<When, string> = {
  today: "Today",
  week: "This week",
  twoWeeks: "Next two weeks",
};

type Props = {
  initial: { title: string; areaId: AreaId; when?: When };
  // Offered as a choice that keeps the plan's current dates.
  currentWindow?: { windowStart: string; windowEnd: string };
  submitTitle: string;
  pending: boolean;
  error?: string;
  onSubmit: (values: EditPlan) => void;
};

export function PlanForm({
  initial,
  currentWindow,
  submitTitle,
  pending,
  error,
  onSubmit,
}: Props) {
  const [title, setTitle] = useState(initial.title);
  const [areaId, setAreaId] = useState(initial.areaId);
  const [when, setWhen] = useState(initial.when);
  const { issue, setIssues } = useIssues();

  function submit() {
    if (pending) return;
    const parsed = EditPlan.safeParse({ title, areaId, when });
    setIssues(parsed.success ? [] : parsed.error.issues);
    if (parsed.success) onSubmit(parsed.data);
  }

  return (
    <View style={styles.fields}>
      <Field
        label="What"
        value={title}
        onChangeText={setTitle}
        error={issue("title") ?? error}
        autoFocus={!currentWindow}
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <View style={styles.field}>
        <Text variant="label">Where</Text>
        <View style={styles.chips}>
          {AREAS.map((area) => (
            <Chip
              key={area.id}
              label={area.name}
              selected={area.id === areaId}
              onPress={() => setAreaId(area.id)}
            />
          ))}
        </View>
      </View>
      <View style={styles.field}>
        <Text variant="label">When</Text>
        <View style={styles.chips}>
          {currentWindow ? (
            <Chip
              label={formatWindow(
                currentWindow.windowStart,
                currentWindow.windowEnd,
              )}
              selected={when === undefined}
              onPress={() => setWhen(undefined)}
            />
          ) : null}
          {When.options.map((option) => (
            <Chip
              key={option}
              label={whenLabels[option]}
              selected={option === when}
              onPress={() => setWhen(option)}
            />
          ))}
        </View>
      </View>
      <Button title={submitTitle} onPress={submit} loading={pending} />
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: space.lg },
  field: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
