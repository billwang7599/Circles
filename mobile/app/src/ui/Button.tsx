import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { Text } from "./Text";
import { radius, size, space, useTheme } from "./theme";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
}: Props) {
  const { colors } = useTheme();
  const background = {
    primary: colors.accent,
    secondary: colors.surface,
    ghost: "transparent",
  }[variant];
  const foreground = {
    primary: colors.onAccent,
    secondary: colors.text,
    ghost: colors.accent,
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          borderColor: variant === "secondary" ? colors.border : background,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <Text variant="label" style={{ color: foreground }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: size.control,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
  },
});
