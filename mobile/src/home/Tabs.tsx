import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../ui/Text";
import { radius, space, useTheme } from "../ui/theme";

type Props<T extends string> = {
  tabs: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

export function Tabs<T extends string>({ tabs, value, onChange }: Props<T>) {
  const { colors } = useTheme();
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
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
              {
                backgroundColor: selected ? colors.primary : "transparent",
                borderColor: colors.primary,
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
  tabs: { flexDirection: "row", gap: space.lg },
  tab: {
    minWidth: 128,
    height: 50,
    paddingHorizontal: space.xl,
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
