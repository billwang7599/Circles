import { Pressable, StyleSheet } from "react-native";
import { Text } from "./Text";
import { radius, size, space, useTheme } from "./theme";

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
};

// A chalk pill with a field-line outline; ink when selected.
export function Chip({ label, selected = false, onPress }: Props) {
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
          backgroundColor: selected ? colors.primary : colors.card,
          borderColor: selected ? colors.primary : colors.input,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text variant="button" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: size.small,
    alignItems: "center",
    borderRadius: radius.full,
    borderWidth: 1.2,
    paddingHorizontal: space.lg,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
});
