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
import { Text } from "../ui/Text";
import { font, radius, size, space, useTheme } from "../ui/theme";
import type { AgendaItem } from "./agenda";

// The next few locked-in plans, one per page, swiped through.
export function FeaturedPlans({ items }: { items: AgendaItem[] }) {
  const { colors } = useTheme();
  const screen = useWindowDimensions();
  // The column's width, known before layout so a page never starts at zero.
  const width = Math.min(screen.width, size.maxWidth);
  const [page, setPage] = useState(0);

  if (items.length === 0)
    return (
      <View style={styles.page}>
        <Text>{formatDay(todayKey())}</Text>
        <Text
          variant="planTitle"
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          accessibilityRole="header"
          style={styles.empty}
        >
          Nothing planned yet
        </Text>
      </View>
    );

  return (
    <View style={styles.hero}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) =>
          setPage(Math.round(event.nativeEvent.contentOffset.x / width))
        }
        scrollEventThrottle={16}
      >
        {items.map((item) => (
          <Pressable
            key={item.plan.id}
            accessibilityRole="button"
            onPress={() =>
              router.push(
                `/circles/${item.circle.circle.id}/plans/${item.plan.id}`,
              )
            }
            style={({ pressed }) => [
              styles.page,
              { width, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text>{formatDay(item.day)}</Text>
            <View style={styles.row}>
              <Text
                variant="planTitle"
                numberOfLines={3}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                accessibilityRole="header"
                style={styles.title}
              >
                {item.plan.title}
              </Text>
              <View
                style={[styles.side, { borderLeftColor: colors.foreground }]}
              >
                <Text numberOfLines={2} style={styles.circle}>
                  {item.circle.circle.name}
                </Text>
                <Text numberOfLines={2} style={styles.when}>
                  {item.when} · Locked in
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      {items.length > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden>
          {items.map((item, index) => (
            <View
              key={item.plan.id}
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
  hero: { gap: space.inline },
  empty: { maxWidth: 320 },
  page: { gap: space.inline, paddingHorizontal: space.gutter },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  title: { flex: 1.5 },
  side: {
    flex: 1,
    borderLeftWidth: 1.25,
    paddingLeft: 14,
    paddingVertical: 10,
    gap: space.xs,
  },
  circle: {
    fontFamily: font.semibold,
    fontSize: 19,
    lineHeight: 21,
    letterSpacing: -0.76,
  },
  when: {
    fontFamily: font.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.12,
  },
  dots: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: space.gutter,
  },
  dot: { width: 6, height: 6, borderRadius: radius.full },
});
