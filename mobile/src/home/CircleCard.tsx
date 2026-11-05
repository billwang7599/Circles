import type { CircleView, Me } from "@circles/shared";
import { Pressable, StyleSheet, View } from "react-native";
import { AvatarStack } from "../ui/AvatarStack";
import { Text } from "../ui/Text";
import { circleTone, font, radius, space, useTheme } from "../ui/theme";
import { isOver, needsMe, nextLine, plural } from "./agenda";

type Props = {
  circle: Me["circles"][number];
  // The circle's members and plans, once loaded.
  view?: CircleView;
  // Tucks this card under the bottom of the one before, as a stack.
  stacked?: boolean;
  // Another card tucks under this one, so its bottom is left free for it.
  covered?: boolean;
  onPress: () => void;
};

// How far each card slides up under the one above it.
export const STACK_OVERLAP = 28;

export function CircleCard({
  circle,
  view,
  stacked = false,
  covered = false,
  onPress,
}: Props) {
  const { colors } = useTheme();
  const tone = circleTone(circle.id);
  const upcoming = view?.plans.filter((plan) => !isOver(plan)).length;
  const urgent = needsMe(circle.next);
  const status = urgent
    ? nextLine(circle.next)
    : upcoming !== undefined
      ? `${plural(upcoming, "upcoming plan")}${
          view ? ` · ${plural(view.members.length, "member")}` : ""
        }`
      : nextLine(circle.next);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${circle.name}, ${status}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        stacked && styles.stacked,
        covered && styles.covered,
        { backgroundColor: tone.fill, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.text}>
        <Text
          numberOfLines={1}
          style={[styles.name, { color: tone.ink }]}
          accessibilityElementsHidden
        >
          {circle.name}
        </Text>
        <View style={styles.statusRow}>
          {urgent ? (
            <View style={[styles.flag, { backgroundColor: colors.accent }]} />
          ) : null}
          <Text
            numberOfLines={1}
            style={[
              styles.status,
              {
                color: tone.ink,
                fontFamily: urgent ? font.medium : font.regular,
              },
            ]}
          >
            {status}
          </Text>
        </View>
      </View>
      {view ? (
        <AvatarStack
          members={view.members}
          ringColor={tone.fill}
          moreColor={tone.ink}
          moreTextColor={tone.onInk}
          size={30}
          max={3}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderRadius: radius.card + 6,
    paddingHorizontal: space.gutter + 2,
    paddingTop: space.gutter,
    paddingBottom: space.gutter + 2,
  },
  stacked: {
    marginTop: -STACK_OVERLAP,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
  },
  covered: { paddingBottom: space.gutter + 2 + STACK_OVERLAP },
  text: { flex: 1, gap: 2 },
  name: {
    fontFamily: font.medium,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -1.5,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: space.inline },
  flag: { width: 8, height: 8, borderRadius: radius.full },
  status: { flexShrink: 1, fontSize: 15, lineHeight: 20, letterSpacing: -0.4 },
});
