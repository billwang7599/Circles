import {
  CreateEvent,
  exactRange,
  Preset,
  presetLabels,
  presetWindow,
  ReadDates,
  type DateWindow,
} from "@circles/shared";
import { router, Stack } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useCreateEvent, useReadDates } from "../../api";
import { deviceTimezone, todayKey } from "../../dates";
import { DateRangePicker } from "../../event/DateRangePicker";
import { eventHref } from "../../routes";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Field, useIssues } from "../../ui/Field";
import { IconButton } from "../../ui/IconButton";
import { Screen } from "../../ui/Screen";
import { MetaItem, ScreenTitle } from "../../ui/ScreenTitle";
import { Section } from "../../ui/Section";
import { Text } from "../../ui/Text";
import { space } from "../../ui/theme";

// Where the range came from, so the matching chip lights up.
type Source = { kind: "preset"; preset: Preset } | { kind: "text" | "pick" };

export default function NewEvent() {
  const readDates = useReadDates();
  const create = useCreateEvent();
  const [description, setDescription] = useState("");
  const [whenText, setWhenText] = useState("");
  const [whenError, setWhenError] = useState<string>();
  const [source, setSource] = useState<Source>();
  const [window, setWindow] = useState<DateWindow>();
  const { issue, setIssues } = useIssues();
  const lastRead = useRef<string>(undefined);
  const timezone = deviceTimezone();
  const today = todayKey();

  // A preset or a picked range replaces whatever was typed.
  function clearWhenText() {
    setWhenText("");
    setWhenError(undefined);
    lastRead.current = undefined;
    readDates.reset();
  }

  function choosePreset(preset: Preset) {
    setWindow(presetWindow(preset, today));
    setSource({ kind: "preset", preset });
    clearWhenText();
  }

  function pickDates() {
    setSource({ kind: "pick" });
    clearWhenText();
  }

  function readWhen() {
    const text = whenText.trim();
    if (!text || text === lastRead.current) return;
    lastRead.current = text;
    const parsed = ReadDates.safeParse({ text, today });
    setWhenError(parsed.success ? undefined : parsed.error.issues[0]?.message);
    if (!parsed.success) return;
    readDates.mutate(parsed.data, {
      onSuccess: (range) => {
        setWindow(range);
        setSource({ kind: "text" });
      },
      // The same words can be sent again after a failure.
      onError: () => {
        lastRead.current = undefined;
      },
    });
  }

  function submit() {
    if (!window || create.isPending) return;
    const parsed = CreateEvent.safeParse({ description, ...window, timezone });
    setIssues(parsed.success ? [] : parsed.error.issues);
    if (!parsed.success) return;
    create.mutate(parsed.data, {
      onSuccess: (view) => router.replace(eventHref(view.event.id)),
    });
  }

  const close = () =>
    router.canGoBack() ? router.back() : router.replace("/");
  const ready = description.trim().length > 0 && window !== undefined;
  const dateError = whenError ?? readDates.error?.message;
  const rangeError = issue("windowStart") ?? issue("windowEnd");

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          {create.error ? (
            <Text color="danger">{create.error.message}</Text>
          ) : null}
          <Button
            title="Create event"
            onPress={submit}
            disabled={!ready}
            loading={create.isPending}
          />
        </View>
      }
    >
      <Stack.Screen
        options={{
          headerLeft: () => (
            <IconButton icon="xmark" label="Close" onPress={close} />
          ),
        }}
      />
      <ScreenTitle title="New event" />
      <Field
        accessibilityLabel="What's the plan?"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={300}
        placeholder="Ski trip with Ben and Chloe, somewhere we can drive to"
        error={issue("description")}
      >
        <Text variant="caption" color="textMuted">
          Circles AI reads this to pick your questions
        </Text>
      </Field>
      <Section title="When">
        <View style={styles.chips}>
          {Preset.options.map((preset) => (
            <Chip
              key={preset}
              label={presetLabels[preset]}
              selected={source?.kind === "preset" && source.preset === preset}
              onPress={() => choosePreset(preset)}
            />
          ))}
          <Chip
            label="Pick dates"
            selected={source?.kind === "pick"}
            onPress={pickDates}
          />
        </View>
        {source?.kind === "pick" ? (
          <DateRangePicker
            value={window}
            today={today}
            onChange={(next) => setWindow(next)}
          />
        ) : null}
        <Field
          accessibilityLabel="When, in your own words"
          value={whenText}
          onChangeText={setWhenText}
          onBlur={readWhen}
          onSubmitEditing={readWhen}
          returnKeyType="done"
          maxLength={120}
          placeholder="December or January"
          error={dateError}
        />
        {window ? (
          <MetaItem
            icon="calendar"
            text={exactRange(window.windowStart, window.windowEnd)}
          />
        ) : null}
        {rangeError ? (
          <Text variant="caption" color="danger">
            {rangeError}
          </Text>
        ) : null}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { flex: 1, gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
