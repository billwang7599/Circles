import { StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { space } from "./theme";

type Props = { text: string };

export function Empty({ text }: Props) {
  return (
    <View style={styles.empty}>
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
