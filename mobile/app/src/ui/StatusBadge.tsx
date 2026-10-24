import { StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { radius, space, useTheme } from "./theme";

export function StatusBadge({ status }: { status: "open" | "locked" }) {
  const { colors } = useTheme();
  const color = status === "open" ? colors.success : colors.textMuted;
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text variant="caption" style={{ color }}>
        {status === "open" ? "Open" : "Locked"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
});
