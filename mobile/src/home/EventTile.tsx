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

// What a summary can say about who is coming: it carries counts, not names.
function eventStatus(event: EventSummary) {
  if (event.in + event.out <= 1)
    return event.isOrganizer ? "No one invited yet" : "You're invited";
  if (event.out > 0) return `${event.out} can't make it`;
  return "Everyone's in";
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
    ? {
        fill: colors.surface,
        ink: colors.foreground,
        chip: colors.foreground,
        onChip: colors.surface,
      }
    : eventTone(event.id);
  const range = approxRange(event.windowStart, event.windowEnd, true);
  const status = eventStatus(event);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${range}, ${status}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: tone.fill, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text
        variant="displaySmall"
        numberOfLines={2}
        style={{ color: tone.ink }}
      >
        {event.title}
      </Text>
      <View style={styles.bottom}>
        <Text style={[styles.range, { color: tone.ink }]}>{range}</Text>
        {event.in + event.out > 1 ? (
          <View style={[styles.pill, { backgroundColor: tone.chip }]}>
            <Icon name="people" size={16} color={tone.onChip} />
            <Text variant="button" style={{ color: tone.onChip }}>
              {event.in}
            </Text>
          </View>
        ) : null}
        <Text variant="label" numberOfLines={1} style={{ color: tone.ink }}>
          {status}
        </Text>
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
