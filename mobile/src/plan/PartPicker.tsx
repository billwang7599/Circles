import { Part } from "@circles/shared";
import { Pressable, StyleSheet, View } from "react-native";
import { formatPartHours, partLabels } from "../dates";
import { Icon, type IconName } from "../ui/Icon";
import { Text } from "../ui/Text";
import { radius, space, useTheme } from "../ui/theme";

const partIcons: Record<Part, IconName> = {
  morning: "sun",
  afternoon: "sunset",
  evening: "moon",
};

// Any mix of the day's parts, but always at least one.
export function PartPicker({
  value,
  onChange,
}: {
  value: Part[];
  onChange: (value: Part[]) => void;
}) {
  const { colors } = useTheme();

  function toggle(part: Part) {
    if (!value.includes(part)) onChange([...value, part]);
    else if (value.length > 1) onChange(value.filter((p) => p !== part));
  }

  return (
    <View style={styles.row}>
      {Part.options.map((part) => {
        const checked = value.includes(part);
        const color = checked ? colors.primaryForeground : colors.foreground;
        return (
          <Pressable
            key={part}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={`${partLabels[part]}, ${formatPartHours(part)}`}
            onPress={() => toggle(part)}
            style={({ pressed }) => [
              styles.tile,
              {
                backgroundColor: checked ? colors.primary : colors.surface,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Icon name={partIcons[part]} size={20} color={color} />
            <Text
              variant="label"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={{ color }}
            >
              {partLabels[part]}
            </Text>
            <Text
              variant="caption"
              numberOfLines={1}
              style={{ color, opacity: checked ? 0.8 : 0.65 }}
            >
              {formatPartHours(part)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.sm },
  tile: {
    flex: 1,
    gap: space.xs,
    borderRadius: radius.xxl,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
});
