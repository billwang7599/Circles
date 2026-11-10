import { StyleSheet, View } from "react-native";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { space, useTheme } from "./theme";

export function ScreenTitle({ title }: { title: string }) {
  return (
    <Text variant="title" accessibilityRole="header">
      {title}
    </Text>
  );
}

export function MetaItem({ icon, text }: { icon: IconName; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.item} accessible accessibilityLabel={text}>
      <Icon name={icon} size={14} color={colors.textMuted} />
      <Text color="textMuted" numberOfLines={1} style={styles.shrink}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: "row", alignItems: "center", gap: space.inline },
  shrink: { flexShrink: 1 },
});
