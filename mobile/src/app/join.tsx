import { JoinCircle } from "@circles/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useJoinCircle } from "../api";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Screen } from "../ui/Screen";
import { font, space } from "../ui/theme";

export default function Join() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(params.code ?? "");
  const [name, setName] = useState("");
  const [issues, setIssues] = useState<
    { path: PropertyKey[]; message: string }[]
  >([]);
  const join = useJoinCircle();
  const issue = (field: string) =>
    issues.find((i) => i.path[0] === field)?.message;
  const apiError = join.error?.message;
  const apiErrorField = apiError && /name/i.test(apiError) ? "name" : "code";

  function submit() {
    const parsed = JoinCircle.safeParse({ code, name });
    setIssues(parsed.success ? [] : parsed.error.issues);
    if (parsed.success) {
      join.mutate(parsed.data, {
        onSuccess: ({ circle }) => router.replace(`/circles/${circle.id}`),
      });
    }
  }

  return (
    <Screen>
      <View style={styles.fields}>
        <Field
          label="Code"
          value={code}
          onChangeText={(value) => setCode(value.toUpperCase())}
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
      </View>
      <Button title="Join" onPress={submit} loading={join.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: space.lg },
  code: { fontFamily: font.mono, letterSpacing: 4 },
});
