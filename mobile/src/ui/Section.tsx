import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { space } from "./theme";

type Props = { title: string; action?: ReactNode; children: ReactNode };

export function Section({ title, action, children }: Props) {
  return (
    <View style={styles.section}>
      {action ? (
        <View style={styles.titleRow}>
          <Text
            variant="section"
            accessibilityRole="header"
            style={styles.grow}
          >
            {title}
          </Text>
          {action}
        </View>
      ) : (
        <Text variant="section" accessibilityRole="header">
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  grow: { flex: 1 },
});
