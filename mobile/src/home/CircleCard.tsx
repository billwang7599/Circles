import type { CircleView, Me } from "@circles/shared";
import { Pressable, StyleSheet, View } from "react-native";
import { AvatarStack } from "../ui/AvatarStack";
import { Text } from "../ui/Text";
import { circleTone, font, radius, space } from "../ui/theme";
import { isOver, needsMe, nextLine, plural } from "./agenda";

type Props = {
  circle: Me["circles"][number];
  // The circle's members and plans, once loaded.
  view?: CircleView;
  onPress: () => void;
};

export function CircleCard({ circle, view, onPress }: Props) {
  const tone = circleTone(circle.id);
  const upcoming = view?.plans.filter((plan) => !isOver(plan)).length;
  const status = needsMe(circle.next)
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
          numberOfLines={2}
          style={[styles.name, { color: tone.ink }]}
          accessibilityElementsHidden
        >
          {circle.name}
        </Text>
        {view ? (
          <AvatarStack
            members={view.members}
            ringColor={tone.fill}
            moreColor={tone.ink}
            moreTextColor={tone.onInk}
          />
        ) : null}
      </View>
      <View style={styles.bottom}>
        {view ? (
          <View style={[styles.pill, { backgroundColor: tone.ink }]}>
            <Text variant="button" style={{ color: tone.onInk }}>
              {plural(view.members.length, "member")}
            </Text>
          </View>
        ) : null}
        <Text
          variant="button"
          numberOfLines={1}
          style={[
            styles.status,
            {
              color: tone.ink,
              fontFamily: needsMe(circle.next) ? font.semibold : font.regular,
            },
          ]}
        >
          {status}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card + 4,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.gutter,
    gap: space.lg,
  },
  top: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  name: {
    flex: 1,
    fontFamily: font.semibold,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -2.2,
  },
  bottom: { flexDirection: "row", alignItems: "center", gap: space.md },
  pill: {
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.inline,
  },
  status: { flexShrink: 1 },
});
