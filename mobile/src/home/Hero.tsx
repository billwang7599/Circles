import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { formatDay } from "../dates";
import { Text } from "../ui/Text";
import { radius, space, typeScale, useTheme } from "../ui/theme";
import type { AgendaItem } from "./agenda";

// The next few plans, one per page, swiped through.
export function Hero({ items }: { items: AgendaItem[] }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);

  if (items.length === 0)
    return (
      <View style={styles.page}>
        <Text color="textMuted">Nothing coming up</Text>
        <Text style={typeScale.display}>Start a plan in a circle</Text>
      </View>
    );

  return (
    <View
      style={styles.hero}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) =>
          width &&
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
            <Text variant="headline" style={styles.date}>
              {formatDay(item.day)}
            </Text>
            <View style={styles.row}>
              <Text
                numberOfLines={3}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                accessibilityRole="header"
                style={[typeScale.display, styles.title]}
              >
                {item.plan.title}
              </Text>
              <View
                style={[styles.rule, { backgroundColor: colors.foreground }]}
              />
              <View style={styles.side}>
                <Text numberOfLines={2} style={styles.circle}>
                  {item.circle.circle.name}
                </Text>
                <Text variant="body" numberOfLines={2}>
                  {item.when}
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
  hero: { gap: space.lg },
  page: { gap: space.xs, paddingHorizontal: space.gutter },
  date: { fontFamily: "Inter_500Medium" },
  row: { flexDirection: "row", alignItems: "stretch", gap: space.lg },
  title: { flex: 1.35 },
  rule: { width: 1.5, marginVertical: space.sm },
  side: { flex: 1, justifyContent: "flex-end", gap: space.xs },
  circle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 26,
    lineHeight: 25,
    letterSpacing: -1.2,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: space.xs,
  },
  dot: { width: 9, height: 9, borderRadius: radius.full },
});
