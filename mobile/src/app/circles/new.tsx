import { CreateCircle } from "@circles/shared";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useCreateCircle } from "../../api";
import { setProfileName, useProfileName } from "../../profile";
import { Button } from "../../ui/Button";
import { Field, useIssues } from "../../ui/Field";
import { Screen } from "../../ui/Screen";
import { space } from "../../ui/theme";

export default function NewCircle() {
  const profileName = useProfileName();
  const [name, setName] = useState("");
  const [memberName, setMemberName] = useState(profileName ?? "");
  const { issue, setIssues } = useIssues();
  const create = useCreateCircle();

  function submit() {
    if (create.isPending) return;
    const parsed = CreateCircle.safeParse({ name, memberName });
    setIssues(parsed.success ? [] : parsed.error.issues);
    if (parsed.success) {
      create.mutate(parsed.data, {
        onSuccess: ({ circle }) => {
          setProfileName(parsed.data.memberName);
          router.replace(`/circles/${circle.id}`);
        },
      });
    }
  }

  return (
    <Screen>
      <View style={styles.form}>
        <Field
          label="Circle name"
          value={name}
          onChangeText={setName}
          error={issue("name") ?? create.error?.message}
          autoFocus
        />
        <Field
          label="Your name"
          value={memberName}
          onChangeText={setMemberName}
          error={issue("memberName")}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button
          title="Create circle"
          onPress={submit}
          loading={create.isPending}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
});
