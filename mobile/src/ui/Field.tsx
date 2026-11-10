import { useState, type ReactNode } from "react";
import { StyleSheet, TextInput, type TextInputProps, View } from "react-native";
import { Text } from "./Text";
import { radius, size, space, typeScale, useTheme } from "./theme";

type Props = TextInputProps & {
  // Left out when the placeholder says what the field is.
  label?: string;
  // A unit shown inside the box ahead of the value, such as "$".
  prefix?: string;
  error?: string;
  // Sits inside the box under a multiline value.
  children?: ReactNode;
};

export function Field({
  label,
  prefix,
  error,
  style,
  children,
  ...input
}: Props) {
  const { colors } = useTheme();
  const tall = input.multiline === true;
  return (
    <View style={styles.field}>
      {label ? <Text variant="label">{label}</Text> : null}
      <View
        style={[
          styles.box,
          tall && styles.tallBox,
          {
            backgroundColor: colors.card,
            borderColor: error ? colors.danger : colors.input,
          },
        ]}
      >
        <View style={styles.value}>
          {prefix ? <Text color="textMuted">{prefix}</Text> : null}
          <TextInput
            maxFontSizeMultiplier={1.5}
            accessibilityLabel={label ?? input.placeholder}
            {...input}
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              tall && styles.tallInput,
              { color: colors.foreground },
              style,
            ]}
          />
        </View>
        {children}
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
  field: { gap: space.inline },
  box: {
    borderRadius: radius.card,
    borderWidth: 1,
    paddingHorizontal: space.lg,
  },
  tallBox: { paddingTop: space.md, paddingBottom: space.md, gap: space.md },
  value: { flexDirection: "row", alignItems: "center", gap: space.xs },
  input: { flex: 1, minHeight: size.control, ...typeScale.input },
  tallInput: { minHeight: 72, textAlignVertical: "top" },
});
