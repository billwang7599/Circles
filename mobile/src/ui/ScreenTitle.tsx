import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { space, useTheme } from "./theme";

export function ScreenTitle({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View style={styles.block}>
      {action ? (
        <View style={styles.titleRow}>
          <Text variant="title" accessibilityRole="header" style={styles.grow}>
            {title}
          </Text>
          {action}
        </View>
      ) : (
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
      )}
      {children ? <View style={styles.meta}>{children}</View> : null}
    </View>
  );
}

export function MetaItem({
  icon,
  text,
  label,
}: {
  icon: IconName;
  text: string;
  // What the icon means, for VoiceOver ("Rating 4.3", not "4.3").
  label?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.item} accessible accessibilityLabel={label ?? text}>
      <Icon name={icon} size={14} color={colors.textMuted} />
      <Text color="textMuted" numberOfLines={1} style={styles.shrink}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.xs },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  grow: { flex: 1 },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: space.md,
    rowGap: space.xs,
  },
  item: { flexDirection: "row", alignItems: "center", gap: space.inline },
  shrink: { flexShrink: 1 },
});
