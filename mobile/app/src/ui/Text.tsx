import { Text as RNText, type TextProps } from "react-native";
import { type Colors, typeScale, useTheme } from "./theme";

type Props = TextProps & {
  variant?: keyof typeof typeScale;
  color?: keyof Colors;
};

export function Text({
  variant = "body",
  color = "text",
  style,
  ...rest
}: Props) {
  const { colors } = useTheme();
  return (
    <RNText
      {...rest}
      style={[typeScale[variant], { color: colors[color] }, style]}
    />
  );
}
