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
import { Text } from "../ui/Text";
import { radius, size, space, useTheme } from "../ui/theme";
import { titleVariant } from "./titleVariant";

const side = (event: EventSummary) =>
  event.isOrganizer ? "You're organizing" : "You're invited";

// The next few events, one per page, swiped through: the dates, the title
// as big as its length allows, and whose event it is. Counts and who is in
// belong to the tile below.
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
      >
        {events.map((event) => {
          const range = approxRange(event.windowStart, event.windowEnd, true);
          const variant = titleVariant(event.title);
          return (
            <Pressable
              key={event.id}
              accessibilityRole="button"
              accessibilityLabel={`${event.title}, ${range}, ${side(event)}`}
              onPress={() => router.push(eventHref(event.id))}
              style={({ pressed }) => [
                styles.page,
                { width, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text>{range}</Text>
              <Text
                variant={variant}
                numberOfLines={variant === "display" ? 2 : 3}
                accessibilityRole="header"
              >
                {event.title}
              </Text>
              <Text variant="headline">{side(event)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {events.length > 1 ? (
        <View
          style={styles.dots}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
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
  dots: { flexDirection: "row", gap: space.xs },
  dot: { width: 6, height: 6, borderRadius: radius.full },
});
