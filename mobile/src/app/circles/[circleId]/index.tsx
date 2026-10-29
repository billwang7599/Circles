import {
  areaById,
  nextMove,
  type CircleSummary,
  type CircleView,
  type PlanSummary,
} from "@circles/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { isRefusal, useCircle, useLeaveCircle } from "../../../api";
import { confirmAction } from "../../../confirm";
import { formatStart, formatWindow } from "../../../dates";
import { Avatar } from "../../../ui/Avatar";
import { Button } from "../../../ui/Button";
import { Card } from "../../../ui/Card";
import { Empty } from "../../../ui/Empty";
import { ErrorState } from "../../../ui/ErrorState";
import { Icon } from "../../../ui/Icon";
import { IconButton } from "../../../ui/IconButton";
import { ListRow } from "../../../ui/ListRow";
import { Screen } from "../../../ui/Screen";
import { MetaItem, ScreenTitle } from "../../../ui/ScreenTitle";
import { Section } from "../../../ui/Section";
import { StatusBadge } from "../../../ui/StatusBadge";
import { Text } from "../../../ui/Text";
import { space, useTheme } from "../../../ui/theme";

export default function Circle() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>();
  const circle = useCircle(circleId);
  const leave = useLeaveCircle(circleId);
  const [copied, setCopied] = useState(false);
  const newPlan = () => router.push(`/circles/${circleId}/plans/new`);
  const plans = circle.data?.plans ?? [];
  const over = (plan: PlanSummary) =>
    plan.phase.kind === "ended" || plan.phase.kind === "past";
  const past = plans.filter(over);
  const upcoming = plans.filter((plan) => !over(plan));

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

  return (
    <Screen onRefresh={circle.refetch}>
      {!circle.data || isRefusal(circle.error) ? (
        circle.isError ? (
          <ErrorState
            message={circle.error.message}
            onRetry={() => circle.refetch()}
          />
        ) : (
          <ActivityIndicator />
        )
      ) : (
        <>
          <ScreenTitle title={circle.data.circle.name}>
            <Text color="textMuted">
              {circle.data.members.length === 1
                ? "1 person"
                : `${circle.data.members.length} people`}
            </Text>
          </ScreenTitle>
          <Section
            title="Upcoming events"
            action={
              <IconButton icon="plus" label="New plan" onPress={newPlan} />
            }
          >
            <Card list>
              {upcoming.length === 0 ? (
                <Empty icon="calendar" text="No upcoming events" />
              ) : (
                upcoming.map((plan) => (
                  <PlanRow key={plan.id} plan={plan} circleId={circleId} />
                ))
              )}
            </Card>
          </Section>
          {past.length > 0 ? (
            <Section title="Past events">
              <Card list>
                {past.map((plan) => (
                  <PlanRow key={plan.id} plan={plan} circleId={circleId} />
                ))}
              </Card>
            </Section>
          ) : null}
          <Section title="Members">
            <Card list>
              {circle.data.members.map((member) => (
                <ListRow
                  key={member.id}
                  lead={<Avatar name={member.name} color={member.color} />}
                  title={member.name}
                  trailing={member.id === circle.data.me.id ? "You" : undefined}
                />
              ))}
            </Card>
          </Section>
          <Section title="Join code">
            <Card>
              <Text variant="title">{circle.data.circle.joinCode}</Text>
              <Button
                title={copied ? "Copied" : "Share"}
                variant="secondary"
                onPress={() => share(circle.data.circle)}
              />
            </Card>
          </Section>
          <View style={styles.block}>
            <Button
              title="Leave circle"
              variant="destructive"
              onPress={() => leaveCircle(circle.data)}
              loading={leave.isPending}
            />
            {leave.error ? (
              <Text color="danger">{leave.error.message}</Text>
            ) : null}
          </View>
        </>
      )}
    </Screen>
  );
}

function PlanRow({ plan, circleId }: { plan: PlanSummary; circleId: string }) {
  const { colors } = useTheme();
  const open = () => router.push(`/circles/${circleId}/plans/${plan.id}`);
  const move = nextMove(plan);
  const trailing =
    move === "inputs" ? (
      <Button
        title="I'm in"
        size="small"
        onPress={() =>
          router.push(`/circles/${circleId}/plans/${plan.id}/register`)
        }
      />
    ) : move === "vote" ? (
      <Button title="Vote" size="small" onPress={open} />
    ) : null;
  // The action button sits beside the row's pressable, not inside it, so
  // VoiceOver (and HTML) see two controls.
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        onPress={open}
        style={({ pressed }) => [
          styles.rowMain,
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text variant="headline" numberOfLines={1}>
          {plan.title}
        </Text>
        <MetaItem
          icon="calendar"
          text={
            plan.lockedStart
              ? formatStart(plan.lockedStart, areaById(plan.areaId).timezone)
              : formatWindow(plan.windowStart, plan.windowEnd)
          }
        />
        <StatusBadge phase={plan.phase} />
      </Pressable>
      {trailing}
      <Pressable onPress={open} hitSlop={space.sm} accessible={false}>
        <Icon name="chevron-right" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    paddingRight: space.lg,
  },
  rowMain: {
    flex: 1,
    minHeight: 64,
    justifyContent: "center",
    gap: 2,
    paddingLeft: space.lg,
    paddingVertical: 14,
  },
});
