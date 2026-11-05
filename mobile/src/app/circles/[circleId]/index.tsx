import {
  areaById,
  localDate,
  nextMove,
  type CircleSummary,
  type CircleView,
  type PlanSummary,
} from "@circles/shared";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isRefusal, useCircle, useLeaveCircle } from "../../../api";
import { confirmAction } from "../../../confirm";
import { formatTime } from "../../../dates";
import { isOver, plural } from "../../../home/agenda";
import { STACK_OVERLAP } from "../../../home/CircleCard";
import { Tabs } from "../../../home/Tabs";
import { Avatar } from "../../../ui/Avatar";
import { AvatarStack } from "../../../ui/AvatarStack";
import { Button } from "../../../ui/Button";
import { ErrorState } from "../../../ui/ErrorState";
import { RoundButton } from "../../../ui/RoundButton";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import {
  circleTone,
  font,
  radius,
  space,
  useTheme,
  typeScale,
  type CircleTone,
} from "../../../ui/theme";

const TABS = [
  { id: "plans", label: "Plans" },
  { id: "past", label: "Past" },
  { id: "members", label: "Members" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function Circle() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>();
  const circle = useCircle(circleId);
  const leave = useLeaveCircle(circleId);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("plans");
  const [copied, setCopied] = useState(false);
  const newPlan = () => router.push(`/circles/${circleId}/plans/new`);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const plans = circle.data?.plans ?? [];
  const past = plans.filter(isOver).reverse();
  const upcoming = plans.filter((plan) => !isOver(plan));

  async function share({ name, joinCode }: CircleSummary) {
    if (Platform.OS !== "web") {
      await Share.share({
        message: `Join ${name} on Circles with code ${joinCode}`,
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/join?code=${joinCode}`,
      );
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function leaveCircle({ circle, members }: CircleView) {
    confirmAction(
      `Leave ${circle.name}`,
      members.length === 1
        ? "The circle and its plans will be removed."
        : "You'll need the join code to come back.",
      "Leave",
      () =>
        leave.mutate(undefined, {
          // A circle opened from a link is the first screen: nothing to dismiss.
          onSuccess: () =>
            router.canDismiss() ? router.dismissAll() : router.replace("/"),
        }),
      true,
    );
  }

  const headerStyle = [styles.header, { marginTop: insets.top - space.sm }];

  if (!circle.data || isRefusal(circle.error))
    return (
      <Screen onRefresh={circle.refetch}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={headerStyle}>
          <RoundButton icon="arrow-left" label="Back" onPress={back} />
        </View>
        {circle.isError ? (
          <ErrorState
            message={circle.error.message}
            onRetry={() => circle.refetch()}
          />
        ) : (
          <ActivityIndicator />
        )}
      </Screen>
    );

  const view = circle.data;
  return (
    <Screen
      onRefresh={circle.refetch}
      bareFooter
      footer={
        <Button
          title="+ Plan something new"
          onPress={newPlan}
          style={styles.grow}
        />
      }
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={headerStyle}>
        <RoundButton icon="arrow-left" label="Back" onPress={back} />
        <RoundButton
          icon="share"
          label="Invite people"
          onPress={() => share(view.circle)}
        />
      </View>

      <View style={styles.top}>
        <Hero view={view} />
        <Tabs tabs={TABS} value={tab} onChange={setTab} compact />
      </View>

      {tab === "plans" ? (
        <View style={styles.list}>
          {upcoming.length === 0 ? (
            <Empty
              title="Nothing planned yet"
              text="Pick a few days and Circles finds a time that works for everyone."
            />
          ) : (
            <View>
              {upcoming.map((plan, index) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  circleId={circleId}
                  stacked={index > 0}
                  covered={index < upcoming.length - 1}
                />
              ))}
            </View>
          )}
        </View>
      ) : tab === "past" ? (
        <View style={styles.list}>
          {past.length === 0 ? (
            <Empty
              title="No past plans"
              text="Plans you've done together will show up here."
            />
          ) : (
            <View>
              {past.map((plan, index) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  circleId={circleId}
                  stacked={index > 0}
                  covered={index < past.length - 1}
                />
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.list}>
          <Panel style={styles.invite}>
            <View style={styles.grow}>
              <Text color="textMuted">Join code</Text>
              <Text selectable style={styles.code}>
                {view.circle.joinCode}
              </Text>
            </View>
            <Button
              title={copied ? "Copied" : "Share"}
              icon={copied ? "check" : "share"}
              size="small"
              onPress={() => share(view.circle)}
            />
          </Panel>
          <Panel>
            {view.members.map((member, index) => (
              <MemberRow
                key={member.id}
                member={member}
                me={member.id === view.me.id}
                first={index === 0}
              />
            ))}
          </Panel>
          <Button
            title="Leave circle"
            variant="destructive"
            onPress={() => leaveCircle(view)}
            loading={leave.isPending}
          />
          {leave.error ? (
            <Text color="danger">{leave.error.message}</Text>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function Hero({ view }: { view: CircleView }) {
  const tone = circleTone(view.circle.id);
  const since = view.members.map((member) => member.joinedAt).sort()[0];
  const upcoming = view.plans.filter((plan) => !isOver(plan)).length;
  return (
    <View style={styles.hero}>
      <View>
        <View style={styles.kicker}>
          <View style={[styles.kickerDot, { backgroundColor: tone.fill }]} />
          <Text color="textMuted" variant="section">
            {since ? `Circle since ${monthYear(since)}` : "Circle"}
          </Text>
        </View>
        <Text
          accessibilityRole="header"
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          style={[typeScale.hero, styles.name]}
        >
          {view.circle.name}
        </Text>
      </View>
      <View style={styles.heroMeta}>
        <Stat value={view.members.length} label="members" />
        <Stat value={upcoming} label="upcoming" />
        <Stat value={view.plans.length - upcoming} label="done" />
        <View style={styles.grow} />
        <AvatarStack
          members={view.members}
          ringColor={tone.fill}
          moreColor={tone.ink}
          moreTextColor={tone.onInk}
          size={30}
          max={4}
        />
      </View>
    </View>
  );
}

// What a plan card says, in the tone it is drawn in.
function describe(plan: PlanSummary) {
  const timezone = areaById(plan.areaId).timezone;
  const move = nextMove(plan);
  const status =
    move === "inputs"
      ? "Add your times"
      : move === "vote"
        ? "Vote now"
        : {
            locked: "Locked in",
            past: "Done",
            ended: "Never locked in",
            open: "Planning",
          }[plan.phase.kind];

  if (plan.lockedStart) {
    const start = new Date(plan.lockedStart);
    const day = localDate(start, timezone);
    return {
      status,
      urgent: move !== null,
      label: weekday(day),
      day: dayOfMonth(day),
      month: monthOf(day),
      big: formatTime(plan.lockedStart, timezone),
      small: "Start",
    };
  }
  const days =
    Math.round(
      (Date.parse(plan.windowEnd) - Date.parse(plan.windowStart)) / 86_400_000,
    ) + 1;
  const sameMonth = monthOf(plan.windowStart) === monthOf(plan.windowEnd);
  return {
    status,
    urgent: move !== null,
    label: days === 1 ? weekday(plan.windowStart) : "Finding a day",
    day:
      days === 1
        ? dayOfMonth(plan.windowStart)
        : sameMonth
          ? `${dayOfMonth(plan.windowStart)}–${dayOfMonth(plan.windowEnd)}`
          : dayOfMonth(plan.windowStart),
    month: sameMonth
      ? monthOf(plan.windowStart)
      : `${monthOf(plan.windowStart)} – ${monthOf(plan.windowEnd)}`,
    big: plural(days, "day"),
    small: "to choose from",
  };
}

function PlanCard({
  plan,
  circleId,
  stacked,
  covered,
}: {
  plan: PlanSummary;
  circleId: string;
  // Tucks this card under the one before, so a list reads as a stack.
  stacked: boolean;
  // Another card tucks under this one.
  covered: boolean;
}) {
  const { colors } = useTheme();
  const over = isOver(plan);
  // Each plan wears its own tone, so a list of them reads as a stack of colour.
  const tone: CircleTone = over
    ? { fill: colors.surface, ink: colors.foreground, onInk: colors.surface }
    : circleTone(plan.id);
  const info = describe(plan);
  const open = () =>
    router.push(
      nextMove(plan) === "inputs"
        ? `/circles/${circleId}/plans/${plan.id}/register`
        : `/circles/${circleId}/plans/${plan.id}`,
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${plan.title}, ${info.label}, ${info.big}, ${info.status}`}
      onPress={open}
      style={({ pressed }) => [
        styles.card,
        stacked && styles.stacked,
        covered && styles.covered,
        { backgroundColor: tone.fill, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={styles.grow}>
          <Text
            numberOfLines={2}
            style={[styles.cardTitle, { color: tone.ink }]}
          >
            {plan.title}
          </Text>
          <Text style={[styles.cardLabel, { color: tone.ink }]}>
            {info.label}
          </Text>
        </View>
        <View style={styles.cardDate}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.cardDay, { color: tone.ink }]}
          >
            {info.day}
          </Text>
          <Text style={[styles.cardMonth, { color: tone.ink }]}>
            {info.month}
          </Text>
        </View>
      </View>
      <View style={[styles.cardRule, { backgroundColor: tone.ink }]} />
      <View style={styles.cardBottom}>
        <Text style={[styles.cardBig, { color: tone.ink }]}>{info.big}</Text>
        <Text style={[styles.grow, styles.cardSmall, { color: tone.ink }]}>
          {info.small}
        </Text>
        <View
          style={[
            styles.badge,
            info.urgent
              ? { backgroundColor: tone.ink }
              : { borderWidth: 1.2, borderColor: tone.ink },
          ]}
        >
          <Text
            variant="caption"
            style={[
              styles.badgeText,
              { color: info.urgent ? tone.onInk : tone.ink },
            ]}
          >
            {info.status}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View accessible accessibilityLabel={`${value} ${label}`}>
      <Text variant="stat">{value}</Text>
      <Text color="textMuted">{label}</Text>
    </View>
  );
}

function MemberRow({
  member,
  me,
  first,
}: {
  member: CircleView["members"][number];
  me: boolean;
  first: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.member,
        !first && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
      ]}
    >
      <Avatar name={member.name} color={member.color} size={40} />
      <View style={styles.grow}>
        <Text variant="headline" numberOfLines={1}>
          {member.name}
        </Text>
        <Text color="textMuted">Joined {monthYear(member.joinedAt)}</Text>
      </View>
      {me ? <Text color="textMuted">You</Text> : null}
    </View>
  );
}

function Panel({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: colors.surface }, style]}>
      {children}
    </View>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.empty, { borderColor: colors.border }]}>
      <Text variant="headline">{title}</Text>
      <Text color="textMuted" style={styles.center}>
        {text}
      </Text>
    </View>
  );
}

// YYYY-MM-DD helpers, read in UTC so the day never shifts.
const utc = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" }).format(
    new Date(day),
  );
const weekday = (day: string) => utc(day, { weekday: "long" });
const monthOf = (day: string) => utc(day, { month: "short" }).toUpperCase();
const dayOfMonth = (day: string) => String(new Date(day).getUTCDate());

// "2025-09-14T…" → "Sep 2025", or "Sep '25" when short.
function monthYear(iso: string, short = false) {
  const date = new Date(iso);
  const month = new Intl.DateTimeFormat(undefined, { month: "short" }).format(
    date,
  );
  const year = date.getFullYear();
  return short ? `${month} '${String(year).slice(2)}` : `${month} ${year}`;
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  center: { textAlign: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  top: { gap: space.xl },
  hero: { gap: space.xl },
  kicker: { flexDirection: "row", alignItems: "center", gap: space.sm },
  kickerDot: { width: 12, height: 12, borderRadius: radius.full },
  name: { fontSize: 64, lineHeight: 64, letterSpacing: -3.8 },
  heroMeta: { flexDirection: "row", alignItems: "flex-end", gap: space.xl },
  list: { gap: space.md },
  card: {
    borderRadius: radius.card + 6,
    paddingHorizontal: space.gutter + 2,
    paddingTop: space.gutter,
    paddingBottom: space.lg,
    gap: space.md,
  },
  stacked: {
    marginTop: -STACK_OVERLAP,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
  },
  covered: { paddingBottom: space.lg + STACK_OVERLAP },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  cardTitle: {
    fontFamily: font.medium,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -1.4,
  },
  cardLabel: { fontSize: 15, opacity: 0.75, marginTop: 2 },
  cardDate: { alignItems: "flex-end", maxWidth: "40%" },
  cardDay: {
    fontFamily: font.regular,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -1.3,
  },
  cardMonth: { fontSize: 14, opacity: 0.8 },
  cardRule: { height: 1, opacity: 0.15 },
  cardBottom: { flexDirection: "row", alignItems: "center", gap: space.sm },
  cardBig: {
    fontFamily: font.medium,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.6,
  },
  cardSmall: { fontSize: 15, opacity: 0.7 },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  badgeText: { fontFamily: font.medium, letterSpacing: -0.3 },
  panel: {
    borderRadius: radius.card + 6,
    paddingHorizontal: space.gutter,
    paddingVertical: space.xs,
  },
  invite: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.lg,
  },
  code: {
    fontFamily: font.medium,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: 1.5,
  },
  member: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
  },
  empty: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: radius.card + 4,
    alignItems: "center",
    gap: space.xs,
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
  },
});
