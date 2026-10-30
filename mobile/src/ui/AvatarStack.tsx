import type { AvatarColor } from "@circles/shared";
import { StyleSheet, Text as RNText, View } from "react-native";
import { Avatar } from "./Avatar";
import { font, radius } from "./theme";

type Props = {
  members: { id: string; name: string; color: AvatarColor }[];
  // What the stack sits on, so each avatar's ring cuts it from the one behind.
  ringColor: string;
  // Fill and text of the "+N" disc for the members past `max`.
  moreColor: string;
  moreTextColor: string;
  size?: number;
  max?: number;
};

export function AvatarStack({
  members,
  ringColor,
  moreColor,
  moreTextColor,
  size = 32,
  max = 3,
}: Props) {
  const shown = members.slice(0, max);
  const more = members.length - shown.length;
  const overlap = { marginLeft: -size * 0.28 };
  return (
    <View
      style={styles.stack}
      accessible
      accessibilityLabel={members.map((m) => m.name).join(", ")}
    >
      {shown.map((member, index) => (
        <View key={member.id} style={index > 0 ? overlap : undefined}>
          <Avatar
            name={member.name}
            color={member.color}
            size={size}
            ring
            ringColor={ringColor}
          />
        </View>
      ))}
      {more > 0 ? (
        <View
          style={[
            styles.more,
            overlap,
            {
              width: size,
              height: size,
              backgroundColor: moreColor,
              borderColor: ringColor,
              borderWidth: Math.max(1.5, size / 16),
            },
          ]}
        >
          <RNText
            allowFontScaling={false}
            style={[
              styles.moreText,
              { color: moreTextColor, fontSize: Math.round(size * 0.5) },
            ]}
          >
            {more}
          </RNText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { flexDirection: "row", alignItems: "center" },
  more: {
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  moreText: { fontFamily: font.medium, letterSpacing: -0.5 },
});
