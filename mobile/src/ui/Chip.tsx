import { Pressable, StyleSheet } from "react-native";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { radius, size, space, useTheme } from "./theme";

type Props = {
  label: string;
  icon?: IconName;
  selected?: boolean;
  onPress: () => void;
};

export function Chip({ label, icon, selected = false, onPress }: Props) {
  const { colors } = useTheme();
  const color = selected ? colors.primaryForeground : colors.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      aria-selected={selected}
      onPress={onPress}
      hitSlop={space.xs}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.control,
          borderColor: selected ? colors.primary : colors.input,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {icon ? <Icon name={icon} size={14} color={color} /> : null}
      <Text variant="button" style={{ color }}>
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
    borderWidth: 1.5,
    paddingHorizontal: space.lg,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
});
