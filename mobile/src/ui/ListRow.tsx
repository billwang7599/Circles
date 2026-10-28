import Feather from "@expo/vector-icons/Feather";
import type { ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Text } from "./Text";
import { size, space, useTheme } from "./theme";

type Props = {
  lead: ReactNode;
  title: string;
  trailing?: ReactNode;
  onPress?: () => void;
};

export function ListRow({ lead, title, trailing, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      {lead}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {typeof trailing === "string" ? (
        <Text color="textMuted">{trailing}</Text>
      ) : (
        trailing
      )}
      {onPress ? (
        <Feather name="chevron-right" size={24} color={colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: size.tap + space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
  },
  title: { flex: 1 },
});
