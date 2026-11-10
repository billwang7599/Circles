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
  variant?: "primary" | "secondary" | "destructive" | "ghost";
  size?: "default" | "small";
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

// A full pill: ink for the one primary action, chalk for the rest.
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
  const background = {
    primary: colors.primary,
    secondary: colors.card,
    destructive: colors.card,
    ghost: "transparent",
  }[variant];
  const foreground = {
    primary: colors.primaryForeground,
    secondary: colors.foreground,
    destructive: colors.danger,
    ghost: colors.foreground,
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
          borderColor:
            variant === "secondary" ? colors.foreground : "transparent",
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
      <Text variant="button" style={[styles.title, { color: foreground }]}>
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
    borderWidth: 1.2,
    borderRadius: radius.full,
    paddingHorizontal: space.xl,
  },
  default: { minHeight: size.control },
  small: { minHeight: size.small, minWidth: 72, paddingHorizontal: space.lg },
  // Long labels wrap at large text sizes instead of losing their end.
  title: { flexShrink: 1, textAlign: "center" },
});
