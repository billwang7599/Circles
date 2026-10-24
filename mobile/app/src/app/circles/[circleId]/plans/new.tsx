import { AREAS, CreatePlan, When, type AreaId } from "@circles/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useCreatePlan } from "../../../../api";
import { Button } from "../../../../ui/Button";
import { Chip } from "../../../../ui/Chip";
import { Field } from "../../../../ui/Field";
import { Screen } from "../../../../ui/Screen";
import { Text } from "../../../../ui/Text";
import { space } from "../../../../ui/theme";

const whenLabels: Record<When, string> = {
  today: "Today",
  week: "This week",
  twoWeeks: "Next two weeks",
};

export default function NewPlan() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>();
  const [title, setTitle] = useState("");
  const [areaId, setAreaId] = useState<AreaId>(AREAS[0].id);
  const [when, setWhen] = useState<When>("week");
  const [issues, setIssues] = useState<
    { path: PropertyKey[]; message: string }[]
  >([]);
  const create = useCreatePlan(circleId);
  const issue = (field: string) =>
    issues.find((i) => i.path[0] === field)?.message;

  function submit() {
    const parsed = CreatePlan.safeParse({ title, areaId, when });
    setIssues(parsed.success ? [] : parsed.error.issues);
    if (parsed.success) {
      create.mutate(parsed.data, {
        onSuccess: ({ plan }) =>
          router.replace(`/circles/${circleId}/plans/${plan.id}/register`),
      });
    }
  }

  return (
    <Screen>
      <View style={styles.fields}>
        <Field
          label="What"
          value={title}
          onChangeText={setTitle}
          error={issue("title") ?? create.error?.message}
          autoFocus
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
      </View>
      <Button title="Start plan" onPress={submit} loading={create.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: space.lg },
  field: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
