import { Text as RNText, type TextProps } from "react-native";
import { type Colors, typeScale, useTheme } from "./theme";

type Props = TextProps & {
  variant?: keyof typeof typeScale;
  color?: keyof Colors;
};

export function Text({
  variant = "body",
  color = "foreground",
  style,
  ...rest
}: Props) {
  const { colors } = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={1.5}
      {...rest}
      style={[typeScale[variant], { color: colors[color] }, style]}
    />
  );
}
