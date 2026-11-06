import { CIRCLE_EMOJI, CreateCircle, type CircleEmoji } from "@circles/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useCreateCircle } from "../../api";
import { Button } from "../../ui/Button";
import { closeDialog, Dialog } from "../../ui/Dialog";
import { Field, useIssues } from "../../ui/Field";
import { Text } from "../../ui/Text";
import { radius, size, space, useTheme } from "../../ui/theme";

const emojiRows = [CIRCLE_EMOJI.slice(0, 6), CIRCLE_EMOJI.slice(6)];

export default function NewCircle() {
  const { colors } = useTheme();
  const [emoji, setEmoji] = useState<CircleEmoji>(CIRCLE_EMOJI[0]);
  const [name, setName] = useState("");
  const { issue, setIssues } = useIssues();
  const create = useCreateCircle();

  function submit() {
    if (create.isPending) return;
    const parsed = CreateCircle.safeParse({ name, emoji });
    setIssues(parsed.success ? [] : parsed.error.issues);
    if (parsed.success)
      create.mutate(parsed.data, {
        onSuccess: ({ circle }) => router.replace(`/circles/${circle.id}`),
      });
  }

  return (
    <Dialog title="New circle">
      <View style={styles.emoji}>
        <Text variant="fieldLabel">Emoji</Text>
        {emojiRows.map((row) => (
          <View key={row[0]} style={styles.row}>
            {row.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityLabel={option}
                aria-checked={option === emoji}
                onPress={() => setEmoji(option)}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: colors.muted,
                    borderColor:
                      option === emoji ? colors.primary : "transparent",
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={styles.glyph}>{option}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        error={issue("name") ?? create.error?.message}
        maxLength={40}
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <View style={styles.actions}>
        <Button
          title="Create circle"
          onPress={submit}
          loading={create.isPending}
        />
        <Button title="Cancel" variant="secondary" onPress={closeDialog} />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  emoji: { gap: space.inline },
  row: { flexDirection: "row", gap: space.sm },
  option: {
    flex: 1,
    height: size.control,
    borderWidth: 1,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: { fontSize: 22, lineHeight: 28 },
  actions: { gap: space.sm },
});
