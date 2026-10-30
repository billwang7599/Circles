import { useState } from "react";
import { StyleSheet, TextInput, type TextInputProps, View } from "react-native";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { font, radius, size, space, useTheme } from "./theme";

type Props = TextInputProps & {
  label: string;
  icon?: IconName;
  // A unit shown inside the box ahead of the value, such as "$".
  prefix?: string;
  error?: string;
};

export function Field({ label, icon, prefix, error, style, ...input }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <View style={styles.label}>
        <Text variant="label">{label}</Text>
        {icon ? <Icon name={icon} size={16} color={colors.textMuted} /> : null}
      </View>
      <View
        style={[
          styles.box,
          {
            backgroundColor: colors.control,
            borderColor: error ? colors.danger : colors.input,
          },
        ]}
      >
        {prefix ? (
          <Text color="textMuted" style={styles.prefix}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          maxFontSizeMultiplier={1.5}
          accessibilityLabel={label}
          {...input}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.foreground }, style]}
        />
      </View>
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

// Which field each validation issue is about, for the form's Field errors.
export function useIssues() {
  const [issues, setIssues] = useState<
    { path: PropertyKey[]; message: string }[]
  >([]);
  const issue = (field: string) =>
    issues.find((i) => i.path[0] === field)?.message;
  return { issue, setIssues };
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  label: { flexDirection: "row", alignItems: "center", gap: space.inline },
  box: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    borderRadius: radius.xxl,
    borderWidth: 1.5,
    paddingHorizontal: space.lg,
  },
  prefix: { fontSize: 17 },
  input: {
    flex: 1,
    minHeight: size.control,
    fontFamily: font.regular,
    fontSize: 17,
  },
});
