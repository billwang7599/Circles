import {
  areaById,
  type Interval,
  type OptionView,
  type PlanView,
} from "@circles/shared";
import { useEffect, useState } from "react";
import { Animated, Linking, Platform, StyleSheet, View } from "react-native";
import { formatInterval, useNow } from "../dates";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { Empty } from "../ui/Empty";
import { MetaItem } from "../ui/ScreenTitle";
import { Section } from "../ui/Section";
import { Text } from "../ui/Text";
import { radius, space, useTheme } from "../ui/theme";

export type TimeSlot = { optionId: string; start: string };

export const upcomingTimes = (option: Pick<OptionView, "times">, now: number) =>
  option.times.filter((t) => Date.parse(t.start) > now);

const unverifiedLabels: Record<OptionView["unverified"][number], string> = {
  budget: "Price not confirmed",
  openHours: "Hours not confirmed",
};

export function Options({
  view,
  options,
  selection,
  onSelectTime,
  onVote,
  votingId,
  generating = false,
  error,
}: {
  view: PlanView;
  options: OptionView[];
  selection?: TimeSlot;
  onSelectTime?: (slot: TimeSlot) => void;
  onVote?: (optionId: string) => void;
  votingId?: string;
  generating?: boolean;
  error?: string;
}) {
  const { colors } = useTheme();
  const now = useNow();
  const { timezone } = areaById(view.plan.area.id);
  const { locked, phase } = view.plan;
  const open = phase.kind === "open";
  const myVote = view.members.find((m) => m.id === view.me.id)?.voteOptionId;
  const chosen = options.find((o) => o.id === locked?.optionId);
  const others = chosen ? options.filter((o) => o !== chosen) : options;
  const stale = phase.kind === "open" && phase.options === "stale";
  const voters = (optionId: string) =>
    view.members.filter((m) => m.voteOptionId === optionId).map((m) => m.name);
  return (
    <Section
      title="Options"
      action={
        stale ? (
          <Text variant="caption" color="textMuted">
            Needs a refresh
          </Text>
        ) : undefined
      }
    >
      {options.length === 0 ? (
        generating ? (
          <Finding />
        ) : (
          <Empty icon="map-pin" text="No options yet" />
        )
      ) : (
        <>
          {chosen && locked ? (
            <OptionCard
              option={chosen}
              voters={voters(chosen.id)}
              timeZone={timezone}
              now={now}
              lockedTime={chosen.times.find((t) => t.start === locked.start)}
            />
          ) : null}
          {chosen && others.length > 0 ? (
            <View style={styles.also}>
              <View style={[styles.rule, { backgroundColor: colors.border }]} />
              <Text variant="caption" color="textMuted">
                Also considered
              </Text>
              <View style={[styles.rule, { backgroundColor: colors.border }]} />
            </View>
          ) : null}
          {others.map((option) => (
            <OptionCard
              key={option.id}
              option={option}
              voters={voters(option.id)}
              timeZone={timezone}
              now={now}
              open={open}
              stale={stale}
              voted={option.id === myVote}
              voting={option.id === votingId}
              voteBusy={votingId !== undefined}
              onVote={onVote ? () => onVote(option.id) : undefined}
              selectedStart={
                selection?.optionId === option.id ? selection.start : undefined
              }
              onSelectTime={
                onSelectTime
                  ? (start) => onSelectTime({ optionId: option.id, start })
                  : undefined
              }
            />
          ))}
        </>
      )}
      {error ? <Text color="danger">{error}</Text> : null}
    </Section>
  );
}

function voterLine(names: string[]) {
  if (names.length === 0) return undefined;
  return names.length <= 3
    ? names.join(", ")
    : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

function OptionCard({
  option,
  voters,
  timeZone,
  now,
  open = false,
  stale = false,
  lockedTime,
  voted = false,
  voting = false,
  voteBusy = false,
  onVote,
  selectedStart,
  onSelectTime,
}: {
  option: OptionView;
  voters: string[];
  timeZone: string;
  now: number;
  open?: boolean;
  stale?: boolean;
  lockedTime?: Interval;
  voted?: boolean;
  voting?: boolean;
  // Another card's vote is in flight; one at a time keeps the cache in order.
  voteBusy?: boolean;
  onVote?: () => void;
  selectedStart?: string;
  onSelectTime?: (start: string) => void;
}) {
  const { colors } = useTheme();
  const { place } = option;
  const votes = voterLine(voters);
  const upcoming = upcomingTimes(option, now);
  return (
    <Card
      style={[
        styles.option,
        lockedTime ? { borderColor: colors.primary } : undefined,
      ]}
    >
      <Text variant="headline">{place.name}</Text>
      <View style={styles.meta}>
        {place.rating !== undefined ? (
          <MetaItem
            icon="star"
            text={place.rating.toFixed(1)}
            label={`Rating ${place.rating.toFixed(1)}`}
          />
        ) : null}
        <MetaItem
          icon="map-pin"
          text={`${place.distanceKm.toFixed(1)} km`}
          label={`${place.distanceKm.toFixed(1)} km away`}
        />
      </View>
      {lockedTime ? (
        <>
          <Text>{formatInterval(lockedTime, timeZone)}</Text>
          <Text color="textMuted">{place.address}</Text>
        </>
      ) : null}
      {open && upcoming.length === 0 ? (
        <Text variant="caption" color="textMuted">
          Times passed
        </Text>
      ) : onSelectTime ? (
        <View style={styles.chips}>
          {upcoming.map((time) => (
            <Chip
              key={time.start}
              label={formatInterval(time, timeZone)}
              icon={time.start === selectedStart ? "lock" : undefined}
              selected={time.start === selectedStart}
              onPress={() => onSelectTime(time.start)}
            />
          ))}
        </View>
      ) : open ? (
        upcoming.map((time) => (
          <Text key={time.start} color={stale ? "textMuted" : "foreground"}>
            {formatInterval(time, timeZone)}
          </Text>
        ))
      ) : null}
      {option.summary ? <Text>{option.summary}</Text> : null}
      {option.unverified.map((reason) => (
        <Text key={reason} variant="caption" color="textMuted">
          {unverifiedLabels[reason]}
        </Text>
      ))}
      {onVote && upcoming.length > 0 ? (
        <View style={styles.voteRow}>
          <View style={styles.grow}>
            {votes ? (
              <MetaItem icon="check" text={votes} label={`Voted: ${votes}`} />
            ) : null}
          </View>
          <Button
            title={voted ? "Your vote" : "Vote"}
            variant={voted ? "primary" : "secondary"}
            size="small"
            onPress={onVote}
            loading={voting}
            disabled={voteBusy}
          />
        </View>
      ) : votes ? (
        <MetaItem icon="check" text={votes} label={`Voted: ${votes}`} />
      ) : null}
      {lockedTime ? (
        <Button
          title="Open in Maps"
          variant="secondary"
          icon="map"
          onPress={() => Linking.openURL(place.mapsUrl)}
        />
      ) : null}
    </Card>
  );
}

const barWidths = ["55%", "30%", "70%", "90%"] as const;

// Three card outlines where the options will land.
function Finding() {
  const { colors } = useTheme();
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[styles.finding, { opacity }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Finding options"
    >
      {[0, 1, 2].map((card) => (
        <Card key={card} style={styles.option}>
          {barWidths.map((width) => (
            <View
              key={width}
              style={[styles.bar, { width, backgroundColor: colors.muted }]}
            />
          ))}
        </Card>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  option: { gap: space.sm },
  finding: { gap: space.md },
  bar: { height: 14, borderRadius: radius.md },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: space.md,
    rowGap: 2,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  voteRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  grow: { flex: 1 },
  also: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingTop: space.sm,
  },
  rule: { flex: 1, height: 1 },
});
