import type { AvatarColor } from "@circles/shared";
import { StyleSheet, Text as RNText, View } from "react-native";
import { avatarColors, font, radius, useTheme } from "./theme";

export const avatarSize = 44;

type Props = {
  name: string;
  color: AvatarColor;
  outlined?: boolean;
  ring?: boolean;
};

export function Avatar({ name, color, outlined = false, ring = false }: Props) {
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
        outlined
          ? {
              backgroundColor: "transparent",
              borderWidth: 1,
              borderColor: colors.border,
            }
          : {
              backgroundColor: avatarColors[color],
              borderWidth: ring ? 2 : 0,
              borderColor: colors.background,
            },
      ]}
    >
      <RNText
        allowFontScaling={false}
        style={[
          styles.initials,
          { color: outlined ? colors.textMuted : "#ffffff" },
        ]}
      >
        {initials}
      </RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: avatarSize,
    height: avatarSize,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { fontFamily: font.semibold, fontSize: 15 },
});
