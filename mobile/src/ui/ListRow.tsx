import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "./Icon";
import { Text } from "./Text";
import { radius, size, space, useTheme } from "./theme";

type Props = {
  title: string;
  subtitle?: string;
  emphasis?: boolean;
  lead?: ReactNode;
  tile?: ReactNode;
  trailing?: ReactNode;
  accessibilityLabel?: string;
  onPress?: () => void;
};

export function ListRow({
  title,
  subtitle,
  emphasis = false,
  lead,
  tile,
  trailing,
  accessibilityLabel,
  onPress,
}: Props) {
  const { colors } = useTheme();
  const content = (
    <>
      {tile !== undefined ? (
        <View style={[styles.tile, { backgroundColor: colors.muted }]}>
          {tile}
        </View>
      ) : (
        lead
      )}
      <View style={styles.text}>
        <Text variant="headline" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            variant={emphasis ? "button" : "body"}
            color={emphasis ? "foreground" : "textMuted"}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {typeof trailing === "string" ? (
        <Text color="textMuted">{trailing}</Text>
      ) : (
        trailing
      )}
    </>
  );
  // A plain row is not a control; a disabled Pressable would read as dimmed.
  if (!onPress)
    return (
      <View
        style={styles.row}
        accessible
        accessibilityLabel={accessibilityLabel}
      >
        {content}
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      {content}
      <Icon name="chevron-right" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
  tile: {
    width: size.control,
    height: size.control,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 2 },
});
