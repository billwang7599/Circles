import { router } from "expo-router";
import { Fragment } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { formatDay } from "../dates";
import { Text } from "../ui/Text";
import { font, radius, space, typeScale, useTheme } from "../ui/theme";
import type { AgendaItem } from "./agenda";

const weekday = (date: Date) =>
  new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date);
const dayMonth = (date: Date) =>
  `${String(date.getDate()).padStart(2, "0")} ${new Intl.DateTimeFormat(
    undefined,
    { month: "short" },
  )
    .format(date)
    .toUpperCase()
    .replace(".", "")}`;

// Today's date, set huge, with the counts that matter beside it.
export function Hero({ stats }: { stats: { value: number; label: string }[] }) {
  const now = new Date();
  return (
    <View style={styles.hero}>
      <View>
        <Text color="textMuted" variant="section">
          {weekday(now)}
        </Text>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={typeScale.hero}
        >
          {dayMonth(now)}
        </Text>
      </View>
      <View style={styles.stats}>
        {stats.map((stat) => (
          <Stat key={stat.label} {...stat} />
        ))}
      </View>
    </View>
  );
}

export function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View accessible accessibilityLabel={`${value} ${label}`}>
      <Text variant="stat">{value}</Text>
      <Text color="textMuted">{label}</Text>
    </View>
  );
}

// The next few plans, grouped on one quiet card like an inbox.
export function UpNext({ items }: { items: AgendaItem[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitle}>
        <Text variant="label" accessibilityRole="header" style={styles.grow}>
          Up next
        </Text>
        <Text color="textMuted">{items.length}</Text>
      </View>
      <View style={[styles.group, { backgroundColor: colors.surface }]}>
        {items.length === 0 ? (
          <Text color="textMuted" style={styles.empty}>
            Nothing coming up. Start a plan in a circle.
          </Text>
        ) : (
          items.map((item, index) => (
            <Fragment key={item.plan.id}>
              {index > 0 ? (
                <View
                  style={[styles.divider, { backgroundColor: colors.border }]}
                />
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.plan.title}, ${formatDay(item.day)}, ${item.when}, ${item.circle.circle.name}`}
                onPress={() =>
                  router.push(
                    `/circles/${item.circle.circle.id}/plans/${item.plan.id}`,
                  )
                }
                style={({ pressed }) => [
                  styles.row,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <View
                  style={[styles.dot, { backgroundColor: item.tone.fill }]}
                />
                <View style={styles.grow}>
                  <Text variant="headline" numberOfLines={2}>
                    {item.plan.title}
                  </Text>
                  <Text color="textMuted" numberOfLines={1}>
                    {item.when} · {item.circle.circle.name}
                  </Text>
                </View>
              </Pressable>
            </Fragment>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.xl },
  stats: { flexDirection: "row", gap: space.xxl },
  section: { gap: space.md },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.xs,
  },
  grow: { flex: 1 },
  group: {
    borderRadius: radius.card + 4,
    paddingHorizontal: space.gutter,
    paddingVertical: space.xs,
  },
  divider: { height: StyleSheet.hairlineWidth * 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md + 2,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
  },
  empty: { paddingVertical: space.lg, fontFamily: font.regular },
});
