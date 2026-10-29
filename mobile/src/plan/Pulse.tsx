import type { PlanView } from "@circles/shared";
import { StyleSheet, View } from "react-native";
import { Avatar, avatarSize } from "../ui/Avatar";
import { Text } from "../ui/Text";
import { radius, space, useTheme } from "../ui/theme";

const maxAvatars = 5;

function peopleLine(view: PlanView, attending: number) {
  const { plan, members, me } = view;
  const { phase } = plan;
  if (phase.kind === "locked" || phase.kind === "past")
    return `${attending} going`;
  if (phase.kind === "open") {
    if (phase.options === "none") {
      if (attending === 0) return "Nobody's in yet";
      if (attending === 1) return "Need one more person in";
    } else if (phase.options === "stale") {
      return plan.initiator.id === me.id
        ? "Options need a refresh"
        : `Waiting for ${plan.initiator.name} to refresh options`;
    } else if (
      plan.initiator.id !== me.id &&
      members.find((m) => m.id === me.id)?.voteOptionId
    ) {
      return `Waiting for ${plan.initiator.name} to lock in`;
    }
  }
  return members.length === 1 ? "1 person" : `${members.length} people`;
}

export function Pulse({ view }: { view: PlanView }) {
  const { colors } = useTheme();
  const { members } = view;
  const { kind } = view.plan.phase;
  const locked = kind === "locked" || kind === "past";
  const total = members.length;
  const registered = members.filter((m) => m.registered).length;
  const going = members.filter((m) => m.registered && m.attending);
  const attending = going.length;
  const voted = going.filter((m) => m.voteOptionId).length;
  const shown = locked ? going : members;
  return (
    <View style={styles.pulse}>
      <View style={styles.people}>
        <View style={styles.stack}>
          {shown.slice(0, maxAvatars).map((member, index) => (
            <View
              key={member.id}
              style={[
                styles.stackItem,
                { backgroundColor: colors.background },
                index > 0 && styles.overlap,
              ]}
            >
              <Avatar
                name={member.name}
                color={member.color}
                outlined={!member.registered}
                ring
              />
            </View>
          ))}
          {shown.length > maxAvatars ? (
            <View
              style={[
                styles.stackItem,
                styles.overlap,
                styles.more,
                {
                  backgroundColor: colors.muted,
                  borderColor: colors.background,
                },
              ]}
            >
              <Text variant="label" color="textMuted">
                +{shown.length - maxAvatars}
              </Text>
            </View>
          ) : null}
        </View>
        <Text color="textMuted" numberOfLines={2} style={styles.grow}>
          {peopleLine(view, attending)}
        </Text>
      </View>
      {locked ? null : (
        <View style={styles.meters}>
          {view.options.length > 0 ? (
            <Meter
              label={`${voted} of ${attending} voted`}
              value={voted}
              total={attending}
            />
          ) : (
            <Meter
              label={`${registered} of ${total} answered`}
              value={registered}
              total={total}
            />
          )}
          <Meter
            label={`${attending} of ${total} in`}
            value={attending}
            total={total}
          />
        </View>
      )}
    </View>
  );
}

function Meter({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={styles.meter}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: total, now: value }}
    >
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <View style={[styles.track, { backgroundColor: colors.progressTrack }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: colors.primary,
              width: `${total > 0 ? (value / total) * 100 : 0}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pulse: { gap: space.md },
  people: { flexDirection: "row", alignItems: "center", gap: space.sm },
  stack: { flexDirection: "row", alignItems: "center" },
  stackItem: { borderRadius: radius.full },
  overlap: { marginLeft: -avatarSize / 4 },
  more: {
    width: avatarSize,
    height: avatarSize,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  grow: { flex: 1 },
  meters: { flexDirection: "row", gap: space.md },
  meter: { flex: 1, gap: space.xs },
  track: { height: 6, borderRadius: radius.full, overflow: "hidden" },
  fill: { height: 6, borderRadius: radius.full },
});
