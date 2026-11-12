import type { AvatarColor } from "@circles/shared";
import { StyleSheet, Text as RNText, View } from "react-native";
import { Avatar } from "./Avatar";
import { font, radius, useTheme } from "./theme";

type Props = {
  members: { id: string; name: string; color: AvatarColor }[];
  size?: number;
  max?: number;
};

// Overlapping avatars, each ringed in the background colour, and a "+N"
// disc in ink for the members past `max`.
export function AvatarStack({ members, size = 32, max = 3 }: Props) {
  const { colors } = useTheme();
  const shown = members.slice(0, max);
  const more = members.length - shown.length;
  const overlap = { marginLeft: -size * 0.22 };
  return (
    <View
      style={styles.stack}
      accessible
      accessibilityLabel={members.map((m) => m.name).join(", ")}
    >
      {shown.map((member, index) => (
        <View key={member.id} style={index > 0 ? overlap : undefined}>
          <Avatar name={member.name} color={member.color} size={size} ring />
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
              backgroundColor: colors.foreground,
              borderColor: colors.background,
              borderWidth: Math.max(1.5, size / 16),
            },
          ]}
        >
          <RNText
            allowFontScaling={false}
            style={[
              styles.moreText,
              { color: colors.background, fontSize: Math.round(size * 0.4) },
            ]}
          >
            +{more}
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
  moreText: { fontFamily: font.medium, letterSpacing: -0.7 },
});
