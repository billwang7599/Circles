import { StyleSheet, View } from "react-native";
import { Icon } from "./Icon";
import { Text } from "./Text";
import { radius, space, useTheme } from "./theme";

// Something went wrong, said in place of what the screen would have shown.
export function Alert({ title, message }: { title: string; message?: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.alert,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Icon name="triangle-alert" size={16} color={colors.danger} />
      <View style={styles.text}>
        <Text variant="fieldLabel" color="danger">
          {title}
        </Text>
        {message ? <Text color="danger">{message}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  alert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.cell,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  text: { flex: 1, gap: space.xs },
});
