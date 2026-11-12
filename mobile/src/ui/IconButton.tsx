import { Pressable, StyleSheet } from "react-native";
import { Icon, type IconName } from "./Icon";
import { radius, size, useTheme } from "./theme";

type Props = {
  icon: IconName;
  label: string;
  onPress: () => void;
};

// A bare 20 pt glyph in a 44 pt hit area.
export function IconButton({ icon, label, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Icon name={icon} size={20} color={colors.foreground} />
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
