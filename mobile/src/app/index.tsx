import { JoinCircle, type NextPlan } from "@circles/shared";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isRefusal, useMe } from "../api";
import { setProfileName, useProfileName } from "../profile";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Empty } from "../ui/Empty";
import { ErrorState } from "../ui/ErrorState";
import { Field } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { IconButton } from "../ui/IconButton";
import { ListRow } from "../ui/ListRow";
import { Screen } from "../ui/Screen";
import { ScreenTitle } from "../ui/ScreenTitle";
import { Section } from "../ui/Section";
import { space, useTheme } from "../ui/theme";

function nextLine(next: NextPlan | null) {
  if (!next) return "No plans yet";
  switch (next.kind) {
    case "inputs":
      return "Add your budget and times";
    case "vote":
      return "Needs your vote";
    case "locked":
    case "open":
      return next.title;
  }
}

const needsMe = (next: NextPlan | null) =>
  next?.kind === "inputs" || next?.kind === "vote";

export default function Home() {
  const me = useMe();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const profileName = useProfileName();
  if (!profileName) return <Welcome top={insets.top} />;

  return (
    <Screen onRefresh={me.refetch}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { marginTop: insets.top }]}>
        <ScreenTitle
          title={`Hey ${profileName}`}
          action={
            <IconButton
              icon="gear"
              label="Settings"
              iconSize={22}
              onPress={() => router.push("/settings")}
            />
          }
        />
        <View style={styles.actions}>
          <Button
            title="New circle"
            icon="plus"
            onPress={() => router.push("/circles/new")}
            style={styles.action}
          />
          <Button
            title="Join with code"
            icon="hash"
            variant="secondary"
            onPress={() => router.push("/join")}
            style={styles.action}
          />
        </View>
      </View>
      {!me.data || isRefusal(me.error) ? (
        me.isError ? (
          <ErrorState message={me.error.message} onRetry={() => me.refetch()} />
        ) : (
          <ActivityIndicator />
        )
      ) : me.data.circles.length === 0 ? (
        <Empty icon="users" text="Start a circle or join one with a code" />
      ) : (
        <Section title="My circles">
          <Card list>
            {me.data.circles.map((circle) => (
              <ListRow
                key={circle.id}
                tile={<Icon name="users" size={20} color={colors.textMuted} />}
                title={circle.name}
                subtitle={nextLine(circle.next)}
                emphasis={needsMe(circle.next)}
                onPress={() => router.push(`/circles/${circle.id}`)}
              />
            ))}
          </Card>
        </Section>
      )}
    </Screen>
  );
}

// First run: the name this device will introduce itself with.
function Welcome({ top }: { top: number }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();

  function submit() {
    const parsed = JoinCircle.shape.name.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setProfileName(parsed.data);
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { marginTop: top }]}>
        <ScreenTitle title="Circles" />
      </View>
      <View style={styles.form}>
        <Field
          label="Your name"
          value={name}
          onChangeText={setName}
          error={error}
          autoFocus
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button title="Continue" onPress={submit} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.lg },
  actions: { flexDirection: "row", gap: space.sm },
  action: { flex: 1 },
  form: { gap: space.lg },
});
