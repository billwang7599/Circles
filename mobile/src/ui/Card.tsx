import { StyleSheet, View, type ViewProps } from "react-native";
import { radius, space, useTheme } from "./theme";

export function Card({ style, ...rest }: ViewProps) {
  const { scheme, colors } = useTheme();
  return (
    <View
      {...rest}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: scheme === "light" ? 1 : 0,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, padding: space.lg, gap: space.lg },
});
