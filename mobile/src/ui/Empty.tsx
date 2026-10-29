import { StyleSheet, View } from "react-native";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { space, useTheme } from "./theme";

type Props = { icon: IconName; text: string };

export function Empty({ icon, text }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={32} color={colors.textMuted} />
      <Text color="textMuted" style={styles.text}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", gap: space.md, paddingVertical: space.xl },
  text: { textAlign: "center" },
});
