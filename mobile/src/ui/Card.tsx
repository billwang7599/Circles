import { Children, Fragment } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { radius, space, useTheme } from "./theme";

type Props = ViewProps & {
  // Rows with a hairline between each pair, inset from the left.
  list?: boolean;
  // The quiet-surface version, for what sits beside the chalk cards.
  panel?: boolean;
};

// Chalk on the paper, with no border: depth is tonal.
export function Card({
  list = false,
  panel = false,
  style,
  children,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const rows = list ? Children.toArray(children) : null;
  return (
    <View
      {...rest}
      style={[
        list ? styles.list : styles.card,
        { backgroundColor: panel ? colors.surface : colors.card },
        style,
      ]}
    >
      {rows
        ? rows.map((row, index) => (
            <Fragment key={index}>
              {index > 0 ? (
                <View
                  style={[styles.divider, { backgroundColor: colors.border }]}
                />
              ) : null}
              {row}
            </Fragment>
          ))
        : children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.panel,
    padding: space.gutter,
    gap: space.lg,
  },
  list: { borderRadius: radius.panel, overflow: "hidden" },
  divider: { height: 1, marginLeft: space.lg },
});
