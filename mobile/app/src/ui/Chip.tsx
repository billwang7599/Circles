import { Pressable, StyleSheet } from "react-native";
import { Text } from "./Text";
import { radius, space, useTheme } from "./theme";

type Props = { label: string; selected?: boolean; onPress: () => void };

export function Chip({ label, selected = false, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      aria-selected={selected}
      onPress={onPress}
      hitSlop={space.xs}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.accent : colors.surface,
          borderColor: selected ? colors.accent : colors.border,
        },
      ]}
    >
      <Text
        variant="label"
        style={{ color: selected ? colors.onAccent : colors.text }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
});
