import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { size, space, useTheme } from "./theme";

export function Screen({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + space.gutter },
      ]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.inner}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, alignItems: "center" },
  inner: {
    width: "100%",
    maxWidth: size.maxWidth,
    padding: space.gutter,
    gap: space.xxl,
  },
});
