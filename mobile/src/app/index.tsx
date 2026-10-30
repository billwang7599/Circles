import { JoinCircle, type CircleView } from "@circles/shared";
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
import { isRefusal, useCircles, useMe } from "../api";
import { agenda, isOver } from "../home/agenda";
import { Calendar } from "../home/Calendar";
import { CircleCard } from "../home/CircleCard";
import { Hero } from "../home/Hero";
import { Logo } from "../home/Logo";
import { Tabs } from "../home/Tabs";
import { setProfileName, useProfileName } from "../profile";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Empty } from "../ui/Empty";
import { ErrorState } from "../ui/ErrorState";
import { Field } from "../ui/Field";
import { Icon, type IconName } from "../ui/Icon";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";
import { radius, size, space, useTheme } from "../ui/theme";

const TABS = [
  { id: "home", label: "Home" },
  { id: "calendar", label: "Calendar" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function Home() {
  const me = useMe();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const profileName = useProfileName();
  const [tab, setTab] = useState<Tab>("home");
  const [refreshing, setRefreshing] = useState(false);
  const circles = me.data?.circles ?? [];
  const details = useCircles(circles.map((circle) => circle.id));
  const views = details.flatMap((query) => (query.data ? [query.data] : []));
  const viewOf = (id: string) => views.find((view) => view.circle.id === id);
  const items = agenda(views);

  if (!profileName) return <Welcome />;

  // My avatar, in the colour the first loaded circle gave me.
  const myColor =
    views
      .flatMap((view: CircleView) => view.members)
      .find((member) => circles.some((c) => c.memberId === member.id))?.color ??
    "violet";

  async function refresh() {
    setRefreshing(true);
    try {
      await Promise.all([me.refetch(), ...details.map((d) => d.refetch())]);
    } finally {
      setRefreshing(false);
    }
  }

  const loading = !me.data || isRefusal(me.error);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push("/settings")}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Avatar name={profileName} color={myColor} size={42} />
          </Pressable>
        </View>
        <View style={styles.tabs}>
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
      ) : tab === "calendar" ? (
        <View
          style={[
            styles.column,
            styles.calendar,
            { paddingBottom: insets.bottom + space.xxl },
          ]}
        >
          <Calendar items={items} />
        </View>
      ) : (
        <>
          <View style={[styles.column, styles.hero]}>
            <Hero
              items={items.filter((item) => !isOver(item.plan)).slice(0, 3)}
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
                  variant="section"
                  accessibilityRole="header"
                  style={styles.grow}
                >
                  My Circles
                </Text>
                <RoundButton
                  icon="hash"
                  label="Join with code"
                  onPress={() => router.push("/join")}
                />
                <RoundButton
                  icon="plus"
                  label="New circle"
                  onPress={() => router.push("/circles/new")}
                />
              </View>
              {circles.length === 0 ? (
                <Empty
                  icon="users"
                  text="Start a circle or join one with a code"
                />
              ) : (
                <View style={styles.cards}>
                  {circles.map((circle) => (
                    <CircleCard
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

function RoundButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={space.xs}
      style={({ pressed }) => [
        styles.round,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Icon name={icon} size={18} color={colors.foreground} />
    </Pressable>
  );
}

// First run: the name this device will introduce itself with.
function Welcome() {
  const insets = useSafeAreaInsets();
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
      <View style={[styles.welcome, { marginTop: insets.top }]}>
        <Logo />
        <Text variant="display">Plans with your people</Text>
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
    paddingHorizontal: space.gutter,
    paddingTop: space.md,
  },
  tabs: { paddingHorizontal: space.gutter, paddingTop: space.xl },
  hero: { paddingTop: space.xxl + space.sm, paddingBottom: space.xxl },
  calendar: { paddingTop: space.xxl + space.sm },
  sheet: {
    flexGrow: 1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: space.xl,
  },
  sheetInner: { gap: space.md, paddingHorizontal: space.md },
  sheetTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingLeft: space.sm,
    paddingRight: space.xs,
    paddingBottom: space.xs,
  },
  grow: { flex: 1 },
  round: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cards: { gap: space.sm },
  welcome: { gap: space.xl },
  form: { gap: space.lg },
});
