import { approxRange, type EventSummary } from "@circles/shared";
import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { formatDay, todayKey } from "../dates";
import { eventHref } from "../routes";
import { Icon } from "../ui/Icon";
import { Text } from "../ui/Text";
import { radius, size, space, useTheme } from "../ui/theme";

const side = (event: EventSummary) =>
  event.isOrganizer ? "You're organizing" : "You're invited";

const spoken = (event: EventSummary) =>
  `${event.in} in${event.out > 0 ? `, ${event.out} can't make it` : ""}`;

// A title's size steps down with its length so its tracking and line height
// always match: auto-shrinking keeps Display's values at a smaller size and
// crushes the letters together. The column is about half the screen, so
// Display holds seven or eight characters a line.
const titleVariant = (title: string) =>
  title.length <= 20
    ? "display"
    : title.length <= 28
      ? "displaySmall"
      : title.length <= 40
        ? "title"
        : "heading";

// The next few events, one per page, swiped through.
export function FeaturedEvents({ events }: { events: EventSummary[] }) {
  const { colors } = useTheme();
  const screen = useWindowDimensions();
  // The column's width, known before layout so a page never starts at zero.
  const width = Math.min(screen.width, size.maxWidth) - space.gutter * 2;
  const [page, setPage] = useState(0);

  if (events.length === 0)
    return (
      <View style={styles.page}>
        <Text>{formatDay(todayKey())}</Text>
        <Text
          variant="display"
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          accessibilityRole="header"
          style={styles.title}
        >
          Nothing planned yet
        </Text>
      </View>
    );

  return (
    <View style={styles.strip}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) =>
          setPage(Math.round(event.nativeEvent.contentOffset.x / width))
        }
        scrollEventThrottle={16}
      >
        {events.map((event) => {
          const range = approxRange(event.windowStart, event.windowEnd, true);
          return (
            <Pressable
              key={event.id}
              accessibilityRole="button"
              accessibilityLabel={`${event.title}, ${range}, ${side(event)}, ${spoken(event)}`}
              onPress={() => router.push(eventHref(event.id))}
              style={({ pressed }) => [
                styles.page,
                { width, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text>{range}</Text>
              <View style={styles.row}>
                <Text
                  variant={titleVariant(event.title)}
                  numberOfLines={
                    titleVariant(event.title) === "heading" ? 4 : 3
                  }
                  accessibilityRole="header"
                  style={[
                    titleVariant(event.title) === "display" && styles.title,
                    styles.grow,
                  ]}
                >
                  {event.title}
                </Text>
                <View
                  style={[styles.side, { borderLeftColor: colors.foreground }]}
                >
                  <View style={styles.count}>
                    <Icon name="people" size={22} color={colors.foreground} />
                    <Text variant="stat">{event.in}</Text>
                  </View>
                  <Text variant="heading" numberOfLines={2}>
                    {side(event)}
                  </Text>
                  {event.out > 0 ? (
                    <Text color="textMuted">
                      {event.out} can&apos;t make it
                    </Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      {events.length > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden>
          {events.map((event, index) => (
            <View
              key={event.id}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    index === page ? colors.foreground : colors.textMuted,
                  opacity: index === page ? 1 : 0.4,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: space.sm },
  page: { gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.lg },
  // Display's line height sits under its size; a wrapped title needs room.
  title: { lineHeight: 54 },
  grow: { flex: 1.3 },
  side: {
    flex: 1.2,
    borderLeftWidth: 1.2,
    paddingLeft: space.lg,
    paddingVertical: space.sm,
    gap: space.xs,
  },
  count: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dots: { flexDirection: "row", gap: space.xs },
  dot: { width: 6, height: 6, borderRadius: radius.full },
});
