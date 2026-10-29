import { JoinCircle } from "@circles/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useJoinCircle } from "../api";
import { setProfileName, useProfileName } from "../profile";
import { Button } from "../ui/Button";
import { Field, useIssues } from "../ui/Field";
import { Screen } from "../ui/Screen";
import { font, space } from "../ui/theme";

export default function Join() {
  const params = useLocalSearchParams<{ code?: string }>();
  const profileName = useProfileName();
  const [code, setCode] = useState(params.code ?? "");
  const [name, setName] = useState(profileName ?? "");
  const { issue, setIssues } = useIssues();
  const join = useJoinCircle();
  const apiError = join.error?.message;
  const apiErrorField = apiError && /name/i.test(apiError) ? "name" : "code";

  function submit() {
    if (join.isPending) return;
    const parsed = JoinCircle.safeParse({ code, name });
    setIssues(parsed.success ? [] : parsed.error.issues);
    if (parsed.success) {
      join.mutate(parsed.data, {
        onSuccess: ({ circle }) => {
          setProfileName(parsed.data.name);
          router.replace(`/circles/${circle.id}`);
        },
      });
    }
  }

  return (
    <Screen>
      <View style={styles.form}>
        <Field
          label="Join code"
          value={code}
          onChangeText={setCode}
          error={
            issue("code") ?? (apiErrorField === "code" ? apiError : undefined)
          }
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          autoFocus={!params.code}
          style={styles.code}
        />
        <Field
          label="Your name"
          value={name}
          onChangeText={setName}
          error={
            issue("name") ?? (apiErrorField === "name" ? apiError : undefined)
          }
          autoFocus={!!params.code}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button title="Join circle" onPress={submit} loading={join.isPending} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  code: { fontFamily: font.semibold },
});
