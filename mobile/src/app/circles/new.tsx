import { CreateCircle } from "@circles/shared";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useCreateCircle } from "../../api";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Screen } from "../../ui/Screen";
import { space } from "../../ui/theme";

export default function NewCircle() {
  const [name, setName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [issues, setIssues] = useState<
    { path: PropertyKey[]; message: string }[]
  >([]);
  const create = useCreateCircle();
  const issue = (field: string) =>
    issues.find((i) => i.path[0] === field)?.message;

  function submit() {
    const parsed = CreateCircle.safeParse({ name, memberName });
    setIssues(parsed.success ? [] : parsed.error.issues);
    if (parsed.success) {
      create.mutate(parsed.data, {
        onSuccess: ({ circle }) => router.replace(`/circles/${circle.id}`),
      });
    }
  }

  return (
    <Screen>
      <View style={styles.fields}>
        <Field
          label="Circle name"
          value={name}
          onChangeText={setName}
          error={issue("name")}
          autoFocus
        />
        <Field
          label="Your name"
          value={memberName}
          onChangeText={setMemberName}
          error={issue("memberName") ?? create.error?.message}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </View>
      <Button title="Create" onPress={submit} loading={create.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({ fields: { gap: space.lg } });
