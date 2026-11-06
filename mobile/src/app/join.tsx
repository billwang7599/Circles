import { JoinCircle } from "@circles/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useJoinCircle } from "../api";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { closeDialog, Dialog } from "../ui/Dialog";
import { Field, useIssues } from "../ui/Field";
import { font, space } from "../ui/theme";

export default function Join() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(params.code ?? "");
  const { issue, setIssues } = useIssues();
  const join = useJoinCircle();

  function submit() {
    if (join.isPending) return;
    const parsed = JoinCircle.safeParse({ code });
    setIssues(parsed.success ? [] : parsed.error.issues);
    if (parsed.success)
      join.mutate(parsed.data, {
        onSuccess: ({ circle }) => router.replace(`/circles/${circle.id}`),
      });
  }

  return (
    <Dialog title="Join a circle">
      {join.error ? (
        <Alert
          title="We could not join that circle"
          message={join.error.message}
        />
      ) : null}
      <Field
        label="Join code"
        value={code}
        onChangeText={setCode}
        error={issue("code")}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        autoFocus={!params.code}
        returnKeyType="go"
        onSubmitEditing={submit}
        style={styles.code}
      />
      <View style={styles.actions}>
        <Button title="Join circle" onPress={submit} loading={join.isPending} />
        <Button title="Cancel" variant="secondary" onPress={closeDialog} />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  actions: { gap: space.sm },
  code: {
    fontFamily: font.semibold,
    fontSize: 17,
    textAlign: "center",
  },
});
