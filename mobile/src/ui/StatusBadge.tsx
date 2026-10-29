import type { PlanPhase } from "@circles/shared";
import { StyleSheet, View } from "react-native";
import { Icon } from "./Icon";
import { Text } from "./Text";
import { space, useTheme } from "./theme";

export function StatusBadge({ phase }: { phase: PlanPhase }) {
  const { colors } = useTheme();
  const badge =
    phase.kind === "locked" || phase.kind === "past"
      ? { icon: "check" as const, text: "Locked in" }
      : phase.kind === "ended"
        ? { icon: "clock" as const, text: "Ended" }
        : null;
  if (!badge) return null;
  return (
    <View style={styles.badge}>
      <Icon name={badge.icon} size={18} color={colors.textMuted} />
      <Text color="textMuted">{badge.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: space.inline },
});
