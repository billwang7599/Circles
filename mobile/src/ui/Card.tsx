import { Children, Fragment } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { radius, space, useTheme } from "./theme";

type Props = ViewProps & { list?: boolean };

export function Card({ list = false, style, children, ...rest }: Props) {
  const { colors } = useTheme();
  const rows = list ? Children.toArray(children) : null;
  return (
    <View
      {...rest}
      style={[
        list ? styles.list : styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
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
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.gutter,
    gap: space.lg,
  },
  list: { borderWidth: 1, borderRadius: radius.card, overflow: "hidden" },
  divider: { height: 1, marginLeft: space.lg },
});
