import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { AvatarStack } from "../ui/AvatarStack";
import { Text } from "../ui/Text";
import { font, radius, space, useTheme } from "../ui/theme";
import { circleInitials, type AgendaItem } from "./agenda";

export function PlanCard({ item }: { item: AgendaItem }) {
  const { colors } = useTheme();
  const { plan, circle, tone } = item;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${plan.title}, ${item.when}, ${circle.circle.name}`}
      onPress={() =>
        router.push(`/circles/${circle.circle.id}/plans/${plan.id}`)
      }
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.text}>
        <Text variant="headline" numberOfLines={2}>
          {plan.title}
        </Text>
        <Text color="textMuted" numberOfLines={1}>
          {item.when} • {circle.circle.name}
        </Text>
        <View style={styles.people}>
          <AvatarStack
            members={circle.members}
            ringColor={colors.surface}
            moreColor={tone.fill}
            moreTextColor={tone.ink}
            size={24}
            max={6}
          />
        </View>
      </View>
      <View style={[styles.badge, { backgroundColor: tone.ink }]}>
        <Text style={[styles.badgeText, { color: tone.fill }]}>
          {circleInitials(circle.circle.name)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    borderRadius: radius.card,
    paddingHorizontal: space.gutter,
    paddingVertical: space.lg,
  },
  text: { flex: 1, gap: 2 },
  people: { marginTop: space.inline },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    marginTop: space.lg,
  },
  badgeText: {
    fontFamily: font.semibold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.5,
  },
});
