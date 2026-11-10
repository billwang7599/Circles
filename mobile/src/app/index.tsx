import { DisplayName } from "@circles/shared";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isRefusal, useMe, useSaveName } from "../api";
import { isPast, todayKey } from "../dates";
import { EventTile } from "../home/EventTile";
import { FeaturedEvents } from "../home/FeaturedEvents";
import { Logo } from "../home/Logo";
import { Tabs } from "../home/Tabs";
import { eventHref, newEventHref, profileHref } from "../routes";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Empty } from "../ui/Empty";
import { ErrorState } from "../ui/ErrorState";
import { Field } from "../ui/Field";
import { RoundButton } from "../ui/RoundButton";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";
import { space } from "../ui/theme";

const TABS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function Home() {
  const me = useMe();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("upcoming");

  if (me.data && !me.data.displayName) return <Welcome />;

  const loading = !me.data || isRefusal(me.error);
  const today = todayKey();
  const events = me.data?.events ?? [];
  // Soonest first; the summaries arrive newest first.
  const upcoming = events
    .filter((event) => !isPast(event, today))
    .sort((a, b) => a.windowStart.localeCompare(b.windowStart));
  const past = events
    .filter((event) => isPast(event, today))
    .sort((a, b) => b.windowEnd.localeCompare(a.windowEnd));
  const shown = tab === "upcoming" ? upcoming : past;
  const openNew = () => router.push(newEventHref);

  const sheet = (
    <View style={styles.sheet}>
      <View style={styles.sheetTitle}>
        <Text variant="headline" accessibilityRole="header" style={styles.grow}>
          My events
        </Text>
        <RoundButton icon="plus" label="New event" onPress={openNew} />
      </View>
      {events.length === 0 ? (
        <Button title="Start an event" icon="plus" onPress={openNew} />
      ) : shown.length === 0 ? (
        <Empty text={tab === "past" ? "No past events" : "Nothing coming up"} />
      ) : (
        <View style={styles.tiles}>
          {shown.map((event) => (
            <EventTile
              key={event.id}
              event={event}
              past={tab === "past"}
              onPress={() => router.push(eventHref(event.id))}
            />
          ))}
        </View>
      )}
    </View>
  );

  return (
    <Screen onRefresh={me.refetch} sheet={loading ? undefined : sheet}>
      <View style={styles.top}>
        <View style={[styles.header, { marginTop: insets.top - space.sm }]}>
          <Logo />
          {me.data?.displayName ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Profile"
              hitSlop={space.sm}
              onPress={() => router.push(profileHref)}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Avatar
                name={me.data.displayName}
                color={me.data.color}
                size={32}
              />
            </Pressable>
          ) : null}
        </View>
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </View>
      {loading ? (
        me.isError ? (
          <ErrorState message={me.error.message} onRetry={() => me.refetch()} />
        ) : (
          <ActivityIndicator />
        )
      ) : (
        <FeaturedEvents events={upcoming.slice(0, 3)} />
      )}
    </Screen>
  );
}

// First run: the name this account goes by on every event.
function Welcome() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const save = useSaveName();

  function submit() {
    if (save.isPending) return;
    const parsed = DisplayName.safeParse(name);
    setError(parsed.success ? undefined : parsed.error.issues[0]?.message);
    if (parsed.success) save.mutate({ displayName: parsed.data });
  }

  return (
    <Screen>
      <View style={[styles.welcome, { marginTop: insets.top }]}>
        <Logo />
        <Text variant="display">Plans with your people</Text>
      </View>
      <View style={styles.form}>
        <Field
          label="Your name"
          value={name}
          onChangeText={setName}
          error={error ?? save.error?.message}
          autoFocus
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button title="Continue" onPress={submit} loading={save.isPending} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { gap: space.gutter },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  grow: { flex: 1 },
  sheet: { gap: space.md },
  // Tall enough for its button, so the row holds its height without it.
  sheetTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingLeft: space.md,
  },
  tiles: { gap: space.md },
  welcome: { gap: space.xl },
  form: { gap: space.lg },
});
