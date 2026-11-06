import { Pressable, StyleSheet } from "react-native";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { radius, size, space, useTheme } from "./theme";

type Props = {
  label: string;
  icon?: IconName;
  selected?: boolean;
  // The smaller chip of a like or dislike.
  tag?: boolean;
  // Out of reach for now; shown at half strength.
  disabled?: boolean;
  onPress: () => void;
};

export function Chip({
  label,
  icon,
  selected = false,
  tag = false,
  disabled = false,
  onPress,
}: Props) {
  const { colors } = useTheme();
  const color = selected ? colors.primaryForeground : colors.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      aria-selected={selected}
      disabled={disabled}
      onPress={onPress}
      hitSlop={tag ? undefined : space.xs}
      style={({ pressed }) => [
        styles.chip,
        tag && styles.tag,
        {
          backgroundColor: selected ? colors.primary : "transparent",
          borderColor: selected ? colors.primary : colors.input,
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        },
      ]}
    >
      {icon ? <Icon name={icon} size={14} color={color} /> : null}
      <Text variant={tag ? "tag" : "button"} style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: size.small,
    flexDirection: "row",
    alignItems: "center",
    gap: space.inline,
    borderRadius: radius.full,
    borderWidth: 1.2,
    paddingHorizontal: space.lg,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  tag: { borderWidth: 1, paddingHorizontal: 14 },
});
