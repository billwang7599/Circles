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
  onPress: () => void;
};

// A circle as a tall card in its own colour: name, faces, members, plans.
export function CircleTile({ circle, view, onPress }: Props) {
  const { scheme } = useTheme();
  const tone = circleTone(circle.id, scheme);
  const urgent = needsMe(circle.next);
  const upcoming = view?.plans.filter((plan) => !isOver(plan)).length;
  const status = urgent
    ? nextLine(circle.next)
    : upcoming !== undefined
      ? plural(upcoming, "upcoming plan")
      : nextLine(circle.next);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${circle.name}, ${status}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: tone.fill, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.top}>
        <Text
          variant="tileName"
          numberOfLines={2}
          style={[styles.name, { color: tone.ink }]}
          accessibilityElementsHidden
        >
          {circle.emoji ? `${circle.emoji} ${circle.name}` : circle.name}
        </Text>
        {view ? (
          <AvatarStack
            members={view.members}
            ringColor={tone.fill}
            moreColor={tone.chip}
            moreTextColor={tone.onChip}
            size={28}
          />
        ) : null}
      </View>
      <View style={styles.bottom}>
        {view ? (
          <View style={[styles.pill, { backgroundColor: tone.chip }]}>
            <Text style={[styles.pillText, { color: tone.onChip }]}>
              {plural(view.members.length, "member")}
            </Text>
          </View>
        ) : null}
        <Text
          numberOfLines={1}
          style={[
            styles.status,
            {
              color: tone.ink,
              fontFamily: urgent ? font.semibold : font.regular,
              opacity: urgent ? 1 : 0.85,
            },
          ]}
        >
          {status}
        </Text>
      </View>
    </Pressable>
  );
}

const metaText = { fontSize: 14, lineHeight: 18, letterSpacing: -0.21 };

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    paddingHorizontal: 22,
    paddingVertical: 18,
    gap: 14,
  },
  top: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  name: { flex: 1 },
  bottom: { flexDirection: "row", alignItems: "center", gap: space.md },
  pill: {
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: 5,
  },
  pillText: { ...metaText, fontFamily: font.medium },
  status: { ...metaText, flexShrink: 1 },
});
