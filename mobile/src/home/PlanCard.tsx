import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { AvatarStack } from "../ui/AvatarStack";
import { Text } from "../ui/Text";
import { font, radius, space } from "../ui/theme";
import { circleInitials, type AgendaItem } from "./agenda";

// How far a stacked card tucks under the one before.
export const STACK_OVERLAP = 28;

export function PlanCard({
  item,
  stacked = false,
  covered = false,
}: {
  item: AgendaItem;
  // Tucks this card under the one before, as the home screen's circles stack.
  stacked?: boolean;
  // Another card tucks under this one.
  covered?: boolean;
}) {
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
        stacked && styles.stacked,
        covered && styles.covered,
        { backgroundColor: tone.fill, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.text}>
        <Text numberOfLines={2} style={[styles.title, { color: tone.ink }]}>
          {plan.title}
        </Text>
        <Text numberOfLines={1} style={{ color: tone.ink, opacity: 0.75 }}>
          {item.when} • {circle.circle.name}
        </Text>
        <View style={styles.people}>
          <AvatarStack
            members={circle.members}
            ringColor={tone.fill}
            moreColor={tone.chip}
            moreTextColor={tone.onChip}
            size={24}
            max={6}
          />
        </View>
      </View>
      <View style={[styles.badge, { backgroundColor: tone.chip }]}>
        <Text style={[styles.badgeText, { color: tone.onChip }]}>
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
    borderRadius: radius.card + 6,
    paddingHorizontal: space.gutter + 2,
    paddingVertical: space.gutter,
  },
  stacked: {
    marginTop: -STACK_OVERLAP,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
  },
  covered: { paddingBottom: space.gutter + STACK_OVERLAP },
  title: {
    fontFamily: font.medium,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.8,
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
    fontFamily: font.medium,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.6,
  },
});
