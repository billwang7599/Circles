import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../ui/Text";
import { radius, space, useTheme } from "../ui/theme";

type Props<T extends string> = {
  tabs: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  // Shorter pills that size to their label, for rows of three or more.
  compact?: boolean;
};

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  compact = false,
}: Props<T>) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.tabs, compact && styles.compactTabs]}
      accessibilityRole="tablist"
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            aria-selected={selected}
            onPress={() => onChange(tab.id)}
            style={({ pressed }) => [
              styles.tab,
              compact && styles.compact,
              {
                backgroundColor: selected ? colors.primary : "transparent",
                borderColor: selected ? colors.primary : colors.input,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text
              variant="button"
              style={{
                color: selected ? colors.primaryForeground : colors.foreground,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: space.sm },
  tab: {
    minWidth: 96,
    height: 44,
    paddingHorizontal: space.gutter,
    borderRadius: radius.full,
    borderWidth: 1.2,
    alignItems: "center",
    justifyContent: "center",
  },
  compactTabs: { gap: space.sm },
  compact: { minWidth: 0, height: 40, paddingHorizontal: space.lg + 2 },
});
