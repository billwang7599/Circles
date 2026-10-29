import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { radius, size, space, useTheme } from "./theme";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "destructive";
  size?: "default" | "small";
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  size: buttonSize = "default",
  icon,
  loading = false,
  disabled = false,
  style,
}: Props) {
  const { colors } = useTheme();
  const background = variant === "primary" ? colors.primary : colors.control;
  const foreground = {
    primary: colors.primaryForeground,
    secondary: colors.foreground,
    destructive: colors.danger,
  }[variant];
  const small = buttonSize === "small";
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={inactive}
      hitSlop={small ? space.xs : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small ? styles.small : styles.default,
        {
          backgroundColor: background,
          borderColor: variant === "primary" ? "transparent" : colors.input,
          opacity: inactive ? 0.5 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : icon ? (
        <Icon name={icon} size={16} color={foreground} />
      ) : null}
      <Text
        variant={small ? "label" : "button"}
        style={[styles.title, { color: foreground }]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderWidth: 1,
    paddingHorizontal: space.lg,
  },
  default: { minHeight: size.control, borderRadius: radius.md },
  small: { minHeight: size.small, borderRadius: radius.lg, minWidth: 72 },
  // Long labels wrap at large text sizes instead of losing their end.
  title: { flexShrink: 1, textAlign: "center" },
});
