import { StyleSheet, Text as RNText, View } from "react-native";
import { font, radius, useTheme } from "./theme";

type Props = { name: string; size?: 32 | 40 | 56; outlined?: boolean };

export function Avatar({ name, size = 40, outlined = false }: Props) {
  const { colors } = useTheme();
  const initials = name
    .split(/\s+/, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          backgroundColor: outlined ? "transparent" : colors.accent,
          borderColor: colors.accent,
          borderWidth: outlined ? 1.5 : 0,
        },
      ]}
    >
      <RNText
        style={{
          fontFamily: font.semibold,
          fontSize: size * 0.4,
          color: outlined ? colors.accent : colors.onAccent,
        }}
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
});
