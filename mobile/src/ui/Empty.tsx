import Feather from "@expo/vector-icons/Feather";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { space, useTheme } from "./theme";

type Props = { icon: ComponentProps<typeof Feather>["name"]; text: string };

export function Empty({ icon, text }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Feather name={icon} size={32} color={colors.textMuted} />
      <Text color="textMuted">{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", gap: space.md, paddingVertical: space.xl },
});
