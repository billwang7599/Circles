import { approxRange, type EventSummary } from "@circles/shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "../ui/Icon";
import { Text } from "../ui/Text";
import {
  eventTone,
  radius,
  space,
  useTheme,
  type EventTone,
} from "../ui/theme";
import { titleVariant } from "./titleVariant";

// What a summary can say about who is coming: it carries counts, not names.
// Nothing when everyone is in, since the pill already counts them.
function eventStatus(event: EventSummary) {
  if (event.in + event.out <= 1)
    return event.isOrganizer ? "No answers yet" : "You're invited";
  if (event.out > 0) return `${event.out} can't make it`;
  return undefined;
}

// An event as a block in its own colour: title, dates, who is in.
export function EventTile({
  event,
  past = false,
  onPress,
}: {
  event: EventSummary;
  // A past event steps back into the quiet surface, keeping its ink.
  past?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const tone: EventTone = past
    ? { fill: colors.surface, ink: colors.foreground }
    : eventTone(event.id);
  const range = approxRange(event.windowStart, event.windowEnd, true);
  const status = eventStatus(event);
  const counted = event.in + event.out > 1;
  // A tile's title tops out at Display Small; a long one steps down to
  // Title rather than losing its end. The tile's column is narrower than
  // the strip's, so it steps down sooner.
  const stepped = titleVariant(event.title, 24) === "title";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${range}${counted ? `, ${event.in} in` : ""}${status ? `, ${status}` : ""}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: tone.fill, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text
        variant={stepped ? "title" : "displaySmall"}
        numberOfLines={3}
        style={{ color: tone.ink }}
      >
        {event.title}
      </Text>
      <View style={styles.bottom}>
        <Text style={[styles.range, { color: tone.ink }]}>{range}</Text>
        {counted ? (
          <View style={[styles.pill, { backgroundColor: tone.ink }]}>
            <Icon name="people" size={16} color={tone.fill} />
            <Text variant="button" style={{ color: tone.fill }}>
              {event.in}
            </Text>
          </View>
        ) : null}
        {status ? (
          <Text variant="label" numberOfLines={1} style={{ color: tone.ink }}>
            {status}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radius.panel,
    paddingTop: space.xl,
    paddingHorizontal: space.xl,
    paddingBottom: space.gutter,
    gap: space.lg,
  },
  bottom: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: space.md,
  },
  range: { flexGrow: 1 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.inline,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.inline,
  },
});
