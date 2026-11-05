import { Pressable, StyleSheet } from "react-native";
import { Icon, type IconName } from "./Icon";
import { radius, space, useTheme } from "./theme";

// The small outlined circle beside a sheet's section titles.
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
          backgroundColor: colors.surface,
          borderColor: colors.border,
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
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
