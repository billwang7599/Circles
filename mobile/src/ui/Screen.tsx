import { useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, size, space, useTheme } from "./theme";

type Props = {
  children: ReactNode;
  // The screen's one next action, over a hairline above the home indicator.
  footer?: ReactNode;
  // Content on the raised chalk panel below, as the home screen's events sit.
  sheet?: ReactNode;
  onRefresh?: () => Promise<unknown>;
  // Off while something inside is being dragged.
  scrollEnabled?: boolean;
};

export function Screen({
  children,
  footer,
  sheet,
  onRefresh,
  scrollEnabled = true,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.screen}
        // The keyboard insets the scroll and brings the focused field above
        // it; a footer stays under the keyboard until it goes away.
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: sheet
              ? 0
              : footer
                ? space.xl
                : insets.bottom + space.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        scrollEnabled={scrollEnabled}
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
              borderTopWidth: 1,
              paddingBottom: space.md + insets.bottom,
            },
          ]}
        >
          <View style={styles.footerInner}>{footer}</View>
        </View>
      ) : null}
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
    marginTop: space.xl,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: space.xl,
    alignItems: "center",
  },
  sheetInner: {
    width: "100%",
    maxWidth: size.maxWidth,
    paddingHorizontal: space.md,
    gap: space.xxl,
  },
  footer: {
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
