import { StyleSheet, View } from "react-native";
import { Text } from "./Text";

// A big number over its label; three in a row in a hero (Profile, an event),
// one at the right of an itinerary card.
export function Stat({
  value,
  label,
  align = "left",
}: {
  // A count, or a share such as "2/3".
  value: number | string;
  label: string;
  // Both lines flush right when the stat sits at a card's right edge.
  align?: "left" | "right";
}) {
  const text = align === "right" ? styles.right : undefined;
  return (
    <View
      accessible
      accessibilityLabel={`${String(value).replace("/", " of ")} ${label}`}
    >
      <Text variant="stat" style={text}>
        {value}
      </Text>
      <Text color="textMuted" numberOfLines={1} style={text}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  right: { textAlign: "right" },
});
