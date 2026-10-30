import type { AvatarColor } from "@circles/shared";
import { StyleSheet, Text as RNText, View } from "react-native";
import { avatarColors, font, radius, useTheme } from "./theme";

export const avatarSize = 44;

type Props = {
  name: string;
  color: AvatarColor;
  outlined?: boolean;
  ring?: boolean;
  // The colour of the ring, where the avatar sits on something other than the background.
  ringColor?: string;
  size?: number;
};

export function Avatar({
  name,
  color,
  outlined = false,
  ring = false,
  ringColor,
  size = avatarSize,
}: Props) {
  const { colors } = useTheme();
  const initials = name
    .split(/\s+/, 2)
    .map((word) => [...word][0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.avatar,
        { width: size, height: size },
        outlined
          ? {
              backgroundColor: "transparent",
              borderWidth: 1,
              borderColor: colors.border,
            }
          : {
              backgroundColor: avatarColors[color],
              borderWidth: ring ? Math.max(1.5, size / 16) : 0,
              borderColor: ringColor ?? colors.background,
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
