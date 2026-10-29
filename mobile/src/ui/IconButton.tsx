import { Pressable, StyleSheet } from "react-native";
import { Icon, type IconName } from "./Icon";
import { radius, size, useTheme } from "./theme";

type Props = {
  icon: IconName;
  label: string;
  onPress: () => void;
  iconSize?: number;
};

export function IconButton({ icon, label, onPress, iconSize = 20 }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Icon name={icon} size={iconSize} color={colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: size.control,
    height: size.control,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
