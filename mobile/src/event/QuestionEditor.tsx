import {
  newId,
  Question,
  type Choice,
  type QuestionKind,
} from "@circles/shared";
import { useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { Field, useIssues } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";
import { space } from "../ui/theme";

const kindLabels: Record<QuestionKind, string> = {
  dates: "Dates",
  budget: "Budget",
  choice: "Pick any",
  text: "Open text",
};

const emptyChoice = (): Choice => ({ id: newId(), label: "", detail: "" });

type Props = {
  // The question to change; a new one otherwise.
  question?: Question;
  // The kinds a new question may have.
  kinds: QuestionKind[];
  onSave: (question: Question) => void;
  onClose: () => void;
};

// A sheet to write one question: its kind, title, hint and, by kind, the
// budget amounts or the options. Laid out by the shared Screen, so Save sits
// in the footer like every other form's primary.
export function QuestionEditor({ question, kinds, onSave, onClose }: Props) {
  const [kind, setKind] = useState<QuestionKind>(
    question?.kind ?? kinds[0] ?? "text",
  );
  const [title, setTitle] = useState(question?.title ?? "");
  const [hint, setHint] = useState(question?.hint ?? "");
  const [amounts, setAmounts] = useState(
    question?.kind === "budget" ? question.presets.join(", ") : "",
  );
  const [choices, setChoices] = useState<Choice[]>(
    question?.kind === "choice"
      ? question.choices
      : [emptyChoice(), emptyChoice()],
  );
  // The option just added, so its field takes focus.
  const [added, setAdded] = useState<string>();
  const { issue, setIssues } = useIssues();

  function save() {
    const base = { id: question?.id ?? newId(), title, hint };
    let candidate: unknown;
    if (kind === "budget") {
      const tokens = amounts.split(/[\s,]+/).filter(Boolean);
      if (tokens.length === 0 || tokens.some((t) => !/^\d+$/.test(t))) {
        setIssues([{ path: ["presets"], message: "Enter whole amounts" }]);
        return;
      }
      candidate = { kind, ...base, presets: tokens.map(Number) };
    } else if (kind === "choice") {
      candidate = {
        kind,
        ...base,
        choices: choices.filter((c) => c.label.trim() || c.detail.trim()),
      };
    } else candidate = { kind, ...base };
    const parsed = Question.safeParse(candidate);
    setIssues(parsed.success ? [] : parsed.error.issues);
    if (parsed.success) onSave(parsed.data);
  }

  // The options' error is about the last Save; typing starts afresh.
  function clearOptionsIssue() {
    setIssues((list) => list.filter((i) => i.path[0] !== "choices"));
  }

  function setChoice(id: string, patch: Partial<Choice>) {
    setChoices((list) =>
      list.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
    clearOptionsIssue();
  }

  function addChoice() {
    const choice = emptyChoice();
    setChoices((list) => [...list, choice]);
    setAdded(choice.id);
    clearOptionsIssue();
  }

  function removeChoice(id: string) {
    setChoices((list) => list.filter((c) => c.id !== id));
    clearOptionsIssue();
  }

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <Screen
        footer={
          <View style={styles.footer}>
            <Button title="Save" onPress={save} />
          </View>
        }
      >
        <View style={styles.heading}>
          <Text variant="title" accessibilityRole="header" style={styles.grow}>
            {question ? "Edit question" : "Add a question"}
          </Text>
          <IconButton icon="xmark" label="Close" onPress={onClose} />
        </View>
        {question ? null : (
          <View style={styles.kinds}>
            {kinds.map((option) => (
              <Chip
                key={option}
                label={kindLabels[option]}
                selected={option === kind}
                onPress={() => setKind(option)}
              />
            ))}
          </View>
        )}
        <View style={styles.group}>
          <Field
            placeholder="Question"
            value={title}
            onChangeText={setTitle}
            error={issue("title")}
            maxLength={60}
            autoFocus={!question}
          />
          <Field
            placeholder="Hint"
            value={hint}
            onChangeText={setHint}
            error={issue("hint")}
            maxLength={120}
          />
          {kind === "budget" ? (
            <Field
              prefix="$"
              placeholder="300, 600, 1000"
              accessibilityLabel="Amounts"
              value={amounts}
              onChangeText={setAmounts}
              error={issue("presets")}
              keyboardType="numbers-and-punctuation"
            />
          ) : null}
        </View>
        {kind === "choice" ? (
          <View style={styles.options}>
            <Text variant="section" accessibilityRole="header">
              Options
            </Text>
            {choices.map((choice, index) => (
              <View key={choice.id} style={styles.option}>
                <View style={styles.grow}>
                  <Field
                    placeholder="Option"
                    accessibilityLabel={`Option ${index + 1}`}
                    value={choice.label}
                    onChangeText={(label) => setChoice(choice.id, { label })}
                    maxLength={40}
                    autoFocus={choice.id === added}
                  />
                </View>
                <View style={styles.grow}>
                  <Field
                    placeholder="Detail"
                    accessibilityLabel={`Detail ${index + 1}`}
                    value={choice.detail}
                    onChangeText={(detail) => setChoice(choice.id, { detail })}
                    maxLength={60}
                  />
                </View>
                {choices.length > 2 ? (
                  <IconButton
                    icon="xmark"
                    label={`Remove option ${index + 1}`}
                    onPress={() => removeChoice(choice.id)}
                  />
                ) : null}
              </View>
            ))}
            {issue("choices") ? (
              <Text variant="caption" color="danger">
                {issue("choices")}
              </Text>
            ) : null}
            {choices.length < 8 ? (
              <Button
                title="Add an option"
                variant="secondary"
                size="small"
                icon="plus"
                onPress={addChoice}
                style={styles.addOption}
              />
            ) : null}
          </View>
        ) : null}
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  footer: { flex: 1 },
  heading: { flexDirection: "row", alignItems: "center", gap: space.sm },
  grow: { flex: 1 },
  kinds: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  group: { gap: space.sm },
  options: { gap: space.md },
  option: { flexDirection: "row", alignItems: "center", gap: space.sm },
  addOption: { alignSelf: "flex-start" },
});
