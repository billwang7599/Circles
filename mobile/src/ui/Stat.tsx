import { View } from "react-native";
import { Text } from "./Text";

// A big number over its label; three in a row in a hero (Profile, an event),
// one on an itinerary card.
export function Stat({
  value,
  label,
}: {
  // A count, or a share such as "2/3".
  value: number | string;
  label: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${String(value).replace("/", " of ")} ${label}`}
    >
      <Text variant="stat">{value}</Text>
      <Text color="textMuted">{label}</Text>
    </View>
  );
}
