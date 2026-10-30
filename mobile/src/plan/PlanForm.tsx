import { areaById, EditPlan, type AreaId, type Part } from "@circles/shared";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Button } from "../ui/Button";
import { useIssues } from "../ui/Field";
import { Screen } from "../ui/Screen";
import { Section } from "../ui/Section";
import { Text } from "../ui/Text";
import { font, space, typeScale, useTheme } from "../ui/theme";
import { DateRangePicker, type DateWindow } from "./DateRangePicker";
import { LocationPicker } from "./LocationPicker";
import { PartPicker } from "./PartPicker";

type Props = {
  heading: string;
  initial: { title: string; areaId: AreaId; parts: Part[] } & DateWindow;
  submitTitle: string;
  pending: boolean;
  error?: string;
  onSubmit: (values: EditPlan) => void;
};

export function PlanForm({
  heading,
  initial,
  submitTitle,
  pending,
  error,
  onSubmit,
}: Props) {
  const { colors } = useTheme();
  const [title, setTitle] = useState(initial.title);
  const [areaId, setAreaId] = useState(initial.areaId);
  const [window, setWindow] = useState<DateWindow>({
    windowStart: initial.windowStart,
    windowEnd: initial.windowEnd,
  });
  const [parts, setParts] = useState(initial.parts);
  const { issue, setIssues } = useIssues();
  const titleError = issue("title");

  function submit() {
    if (pending) return;
    const parsed = EditPlan.safeParse({ title, areaId, ...window, parts });
    setIssues(parsed.success ? [] : parsed.error.issues);
    if (parsed.success) onSubmit(parsed.data);
  }

  return (
    <Screen
      sheet={
        <>
          <Section title="Where">
            <LocationPicker
              value={areaId}
              onChange={setAreaId}
              error={issue("areaId")}
            />
          </Section>
          <Section title="When">
            <DateRangePicker
              value={window}
              timezone={areaById(areaId).timezone}
              onChange={setWindow}
              error={issue("windowEnd") ?? issue("windowStart")}
            />
          </Section>
          <Section title="Time of day">
            <PartPicker value={parts} onChange={setParts} />
            {issue("parts") ? (
              <Text variant="caption" color="danger">
                {issue("parts")}
              </Text>
            ) : null}
          </Section>
          <View style={styles.submit}>
            {error ? <Text color="danger">{error}</Text> : null}
            <Button title={submitTitle} onPress={submit} loading={pending} />
          </View>
        </>
      }
    >
      <View style={styles.what}>
        <Text variant="headline" style={styles.heading}>
          {heading}
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="What are we doing?"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="What"
          autoFocus={!initial.title}
          multiline
          submitBehavior="blurAndSubmit"
          returnKeyType="done"
          maxFontSizeMultiplier={1.2}
          style={[
            styles.title,
            {
              color: colors.foreground,
              borderBottomColor: titleError ? colors.danger : colors.border,
            },
          ]}
        />
        {titleError ? (
          <Text variant="caption" color="danger">
            {titleError}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  what: { gap: space.sm, paddingTop: space.lg },
  heading: { fontFamily: font.medium },
  title: {
    ...typeScale.display,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.8,
    paddingVertical: space.sm,
    borderBottomWidth: 1.5,
  },
  submit: { gap: space.sm },
});
