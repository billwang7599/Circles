import { Pressable, StyleSheet } from "react-native";
import { Icon, type IconName } from "./Icon";
import { radius, space, useTheme } from "./theme";

// The small outlined circle of a screen's top bar.
export function RoundButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={space.xs}
      style={({ pressed }) => [
        styles.round,
        {
          backgroundColor: "transparent",
          borderColor: colors.input,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Icon name={icon} size={18} color={colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  round: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1.2,
    alignItems: "center",
    justifyContent: "center",
  },
});
