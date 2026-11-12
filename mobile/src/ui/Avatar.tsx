import type { AvatarColor } from "@circles/shared";
import { StyleSheet, Text as RNText, View } from "react-native";
import { avatarColors, font, radius, useTheme } from "./theme";

const avatarSize = 44;

type Props = {
  name: string;
  color: AvatarColor;
  outlined?: boolean;
  // A ring in the background colour, so stacked avatars cut each other out.
  ring?: boolean;
  size?: number;
};

export function Avatar({
  name,
  color,
  outlined = false,
  ring = false,
  size = avatarSize,
}: Props) {
  const { colors } = useTheme();
  // Two initials, or one in a small disc where two would run into the next.
  const initials = name
    .split(/\s+/, size < 36 ? 1 : 2)
    .map((word) => [...word][0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.avatar,
        { width: size, height: size },
        outlined
          ? { borderWidth: 1, borderColor: colors.border }
          : {
              backgroundColor: avatarColors[color],
              borderWidth: ring ? Math.max(1.5, size / 16) : 0,
              borderColor: colors.background,
            },
      ]}
    >
      <RNText
        allowFontScaling={false}
        style={[
          styles.initials,
          {
            color: outlined ? colors.textMuted : "#ffffff",
            fontSize: Math.round(size * 0.34),
          },
        ]}
      >
        {initials}
      </RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { fontFamily: font.semibold },
});
