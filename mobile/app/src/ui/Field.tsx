import Feather from "@expo/vector-icons/Feather";
import type { ComponentProps } from "react";
import { StyleSheet, TextInput, type TextInputProps, View } from "react-native";
import { Text } from "./Text";
import { font, radius, size, space, useTheme } from "./theme";

type Props = TextInputProps & {
  label: string;
  icon?: ComponentProps<typeof Feather>["name"];
  error?: string;
};

export function Field({ label, icon, error, style, ...input }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <View style={styles.label}>
        <Text variant="label">{label}</Text>
        {icon ? (
          <Feather name={icon} size={24} color={colors.textMuted} />
        ) : null}
      </View>
      <TextInput
        {...input}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
            color: colors.text,
          },
          style,
        ]}
      />
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  label: { flexDirection: "row", alignItems: "center", gap: space.sm },
  input: {
    height: size.control,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    fontFamily: font.regular,
    fontSize: 16,
  },
});
