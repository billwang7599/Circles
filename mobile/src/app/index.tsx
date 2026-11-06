import { DisplayName } from "@circles/shared";
import { router, Stack } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isRefusal, useCircles, useMe, useSaveName } from "../api";
import { agenda } from "../home/agenda";
import { Calendar } from "../home/Calendar";
import { CircleTile } from "../home/CircleTile";
import { FeaturedPlans } from "../home/FeaturedPlans";
import { Logo } from "../home/Logo";
import { Profile } from "../home/Profile";
import { Tabs } from "../home/Tabs";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ErrorState } from "../ui/ErrorState";
import { Field } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";
import { font, radius, size, space, useTheme } from "../ui/theme";

const TABS = [
  { id: "home", label: "Home" },
  { id: "calendar", label: "Calendar" },
] as const;
// Profile hangs off the avatar, so neither pill is lit while it shows.
type Tab = (typeof TABS)[number]["id"] | "profile";

export default function Home() {
  const me = useMe();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("home");
  const [refreshing, setRefreshing] = useState(false);
  const circles = me.data?.circles ?? [];
  const details = useCircles(circles.map((circle) => circle.id));
  const views = details.flatMap((query) => (query.data ? [query.data] : []));
  const viewOf = (id: string) => views.find((view) => view.circle.id === id);
  const items = agenda(views, scheme);

  if (me.data && !me.data.displayName) return <Welcome />;

  async function refresh() {
    setRefreshing(true);
    try {
      await Promise.all([me.refetch(), ...details.map((d) => d.refetch())]);
    } finally {
      setRefreshing(false);
    }
  }

  const loading = !me.data || isRefusal(me.error);
  const openNewCircle = () => router.push("/circles/new");
  const openJoin = () => router.push("/join");
  const bottom = { paddingBottom: insets.bottom + space.xl };

  return (
    <ScrollView
      style={{
        backgroundColor:
          tab === "home" ? colors.homeBackground : colors.background,
      }}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.textMuted}
        />
      }
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.column}>
        <View style={styles.header}>
          <Logo />
          {me.data?.displayName ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Profile"
              aria-selected={tab === "profile"}
              hitSlop={space.sm}
              onPress={() => setTab("profile")}
              style={({ pressed }) => [
                styles.avatar,
                tab === "profile" && { borderColor: colors.foreground },
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Avatar
                name={me.data.displayName}
                color={me.data.color}
                size={28}
              />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.nav}>
          <Tabs tabs={TABS} value={tab} onChange={setTab} />
        </View>
      </View>

      {loading ? (
        <View style={[styles.column, styles.padded]}>
          {me.isError ? (
            <ErrorState
              message={me.error.message}
              onRetry={() => me.refetch()}
            />
          ) : (
            <ActivityIndicator />
          )}
        </View>
      ) : tab === "profile" ? (
        <View style={[styles.column, styles.page, bottom]}>
          <Profile me={me.data} />
        </View>
      ) : tab === "calendar" ? (
        <View style={[styles.column, styles.page, bottom]}>
          <Calendar items={items} />
        </View>
      ) : (
        <>
          <View style={[styles.column, styles.body]}>
            <FeaturedPlans
              items={items
                .filter((item) => item.plan.phase.kind === "locked")
                .slice(0, 3)}
            />
          </View>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.sheet,
                paddingBottom: insets.bottom + space.xl,
              },
            ]}
          >
            <View style={[styles.column, styles.sheetInner]}>
              <View style={styles.sheetTitle}>
                <Text
                  variant="strong"
                  accessibilityRole="header"
                  style={styles.grow}
                >
                  My Circles
                </Text>
                {/* With no circles, the empty card below offers these. */}
                {circles.length > 0 ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={space.xs}
                      onPress={openJoin}
                      style={({ pressed }) => [
                        styles.joinPill,
                        {
                          borderColor: colors.foreground,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text style={styles.joinText}>Join with code</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="New circle"
                      hitSlop={space.xs}
                      onPress={openNewCircle}
                      style={({ pressed }) => [
                        styles.newCircle,
                        {
                          backgroundColor: colors.muted,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Icon name="plus" size={16} color={colors.foreground} />
                    </Pressable>
                  </>
                ) : null}
              </View>
              {circles.length === 0 ? (
                <Card style={styles.noCircles}>
                  <View
                    style={[
                      styles.noCirclesIcon,
                      { backgroundColor: colors.muted },
                    ]}
                  >
                    <Icon name="users" size={24} color={colors.foreground} />
                  </View>
                  <Text variant="strong">No circles yet</Text>
                  <View style={styles.noCirclesActions}>
                    <Button
                      title="Create a circle"
                      icon="plus"
                      onPress={openNewCircle}
                    />
                    <Button
                      title="Someone gave me a code"
                      variant="ghost"
                      onPress={openJoin}
                    />
                  </View>
                </Card>
              ) : (
                <View style={styles.cards}>
                  {circles.map((circle) => (
                    <CircleTile
                      key={circle.id}
                      circle={circle}
                      view={viewOf(circle.id)}
                      onPress={() => router.push(`/circles/${circle.id}`)}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

// First run: the name this account goes by in every circle.
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
      <Stack.Screen options={{ headerShown: false }} />
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
  scroll: { flexGrow: 1 },
  column: {
    width: "100%",
    maxWidth: size.maxWidth,
    alignSelf: "center",
  },
  padded: { padding: space.gutter },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    paddingHorizontal: space.gutter,
    paddingTop: space.inline,
    paddingBottom: 18,
  },
  // The ring is always there, unseen until Profile shows, so nothing shifts.
  avatar: {
    padding: 2,
    borderWidth: 1.5,
    borderColor: "transparent",
    borderRadius: radius.full,
  },
  nav: { paddingHorizontal: space.gutter, paddingBottom: space.md },
  page: { paddingTop: space.md },
  // The featured plans pad their own pages, so the body adds no sides.
  body: { paddingTop: 18, paddingBottom: space.gutter },
  grow: { flex: 1 },
  sheet: {
    flexGrow: 1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: 22,
  },
  sheetInner: { gap: 10, paddingHorizontal: space.lg },
  // Tall enough for its buttons, so the row holds its height without them.
  sheetTitle: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingLeft: space.inline,
  },
  joinPill: {
    borderWidth: 1.25,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: space.inline,
  },
  joinText: {
    fontFamily: font.medium,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.21,
  },
  newCircle: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  cards: { gap: 10 },
  noCircles: { alignItems: "center", padding: space.xl },
  noCirclesIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  noCirclesActions: { alignSelf: "stretch", gap: space.sm },
  welcome: { gap: space.xl },
  form: { gap: space.lg },
});
