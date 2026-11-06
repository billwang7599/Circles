import { router } from "expo-router";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { IconButton } from "./IconButton";
import { Text } from "./Text";
import { radius, size, space, useTheme } from "./theme";

// Back to whatever the dialog opened over; a link opened cold has Home there.
export function closeDialog() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

// A card over the screen behind it. Its route is a transparent modal.
export function Dialog({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.root}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={closeDialog}
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
      />
      <View
        accessibilityViewIsModal
        style={[
          styles.card,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.heading}>
            <Text
              variant="listTitle"
              accessibilityRole="header"
              style={styles.title}
            >
              {title}
            </Text>
            <IconButton icon="xmark" label="Close" onPress={closeDialog} />
          </View>
          {children}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
  },
  card: {
    width: "100%",
    maxWidth: size.maxWidth,
    maxHeight: "100%",
    borderWidth: 1,
    borderRadius: radius.dialog,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
  },
  content: { padding: space.xl, gap: space.lg },
  heading: { flexDirection: "row", alignItems: "center", gap: space.sm },
  title: { flex: 1 },
});
