import { useRef, useState, type ComponentRef, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, size, space, useTheme } from "./theme";

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  // Content on the raised panel below, as the home screen's circles sit.
  sheet?: ReactNode;
  onRefresh?: () => Promise<unknown>;
};

export function Screen({ children, footer, sheet, onRefresh }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const root = useRef<ComponentRef<typeof View>>(null);
  // Where this screen starts in the window, so the keyboard math counts the header above it.
  const [top, setTop] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <View
      ref={root}
      style={[styles.screen, { backgroundColor: colors.background }]}
      onLayout={() => root.current?.measureInWindow((_x, y) => setTop(y))}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        // The bottom inset is already padded below, so the keyboard only needs the rest.
        keyboardVerticalOffset={top - insets.bottom}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom: sheet
                ? 0
                : footer
                  ? space.gutter
                  : insets.bottom + space.gutter,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor={colors.textMuted}
              />
            ) : undefined
          }
        >
          <View style={styles.inner}>{children}</View>
          {sheet ? (
            <View
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.sheet,
                  paddingBottom: footer ? space.xl : insets.bottom + space.xl,
                },
              ]}
            >
              <View style={styles.sheetInner}>{sheet}</View>
            </View>
          ) : null}
        </ScrollView>
        {footer ? (
          <View
            style={[
              styles.footer,
              {
                backgroundColor: colors.background,
                borderTopColor: colors.border,
                paddingBottom: space.md + insets.bottom,
              },
            ]}
          >
            <View style={styles.footerInner}>{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, alignItems: "center" },
  inner: {
    width: "100%",
    maxWidth: size.maxWidth,
    paddingHorizontal: space.gutter,
    paddingTop: space.xl,
    gap: space.xxl,
  },
  sheet: {
    flexGrow: 1,
    alignSelf: "stretch",
    marginTop: space.xxl,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: space.xl,
    alignItems: "center",
  },
  sheetInner: {
    width: "100%",
    maxWidth: size.maxWidth,
    paddingHorizontal: space.gutter,
    gap: space.xxl,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: space.gutter,
    paddingTop: space.md,
    alignItems: "center",
  },
  footerInner: {
    width: "100%",
    maxWidth: size.maxWidth,
    flexDirection: "row",
    gap: space.sm,
  },
});
