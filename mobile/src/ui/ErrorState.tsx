import { StyleSheet, View } from "react-native";
import { Button } from "./Button";
import { Text } from "./Text";
import { space } from "./theme";

// The button retries unless the screen names another way out.
export function ErrorState({
  message,
  onRetry,
  retryTitle = "Try again",
}: {
  message: string;
  onRetry: () => void;
  retryTitle?: string;
}) {
  return (
    <View style={styles.error}>
      <Text color="danger">{message}</Text>
      <Button
        title={retryTitle}
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
