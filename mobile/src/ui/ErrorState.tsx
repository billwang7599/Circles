import { StyleSheet, View } from "react-native";
import { Button } from "./Button";
import { Text } from "./Text";
import { space } from "./theme";

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.error}>
      <Text color="danger">{message}</Text>
      <Button
        title="Try again"
        variant="secondary"
        size="small"
        onPress={onRetry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  error: { gap: space.sm, alignItems: "flex-start" },
});
