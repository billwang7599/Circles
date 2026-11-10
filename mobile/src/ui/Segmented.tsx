import { Pressable, StyleSheet, View } from "react-native";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { radius, size, space, useTheme } from "./theme";

type Props<T extends string> = {
  options: readonly { id: T; label: string; icon?: IconName }[];
  value: T | null;
  onChange: (value: T) => void;
};

// Joined choices in one pill; one at most is picked.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: Props<T>) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      style={[styles.group, { borderColor: colors.input }]}
    >
      {options.map((option, index) => {
        const selected = option.id === value;
        const color = selected ? colors.primaryForeground : colors.foreground;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            aria-checked={selected}
            onPress={() => onChange(option.id)}
            style={({ pressed }) => [
              styles.segment,
              index > 0 && {
                borderLeftWidth: 1,
                borderLeftColor: colors.input,
              },
              {
                backgroundColor: selected ? colors.primary : "transparent",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            {option.icon ? (
              <Icon name={option.icon} size={16} color={color} />
            ) : null}
            <Text variant="button" numberOfLines={1} style={{ color }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: "row",
    borderWidth: 1.2,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  segment: {
    flex: 1,
    minHeight: size.control,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.inline,
    paddingHorizontal: space.sm,
  },
});
