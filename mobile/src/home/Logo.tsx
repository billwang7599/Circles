import { StyleSheet, View } from "react-native";
import { Text } from "../ui/Text";
import { radius, useTheme } from "../ui/theme";

const blobs = [
  { color: "#f2c46d", top: 6, left: 7 },
  { color: "#9cc8e8", top: 6, left: 19 },
  { color: "#f2a7c3", top: 18, left: 6 },
  { color: "#b5dba0", top: 18, left: 18 },
];

export function Logo() {
  const { colors } = useTheme();
  return (
    <View
      style={styles.logo}
      accessible
      accessibilityRole="header"
      accessibilityLabel="Circles"
    >
      <View
        style={[
          styles.mark,
          { borderColor: colors.border, backgroundColor: colors.sheet },
        ]}
      >
        {blobs.map((blob) => (
          <View
            key={blob.color}
            style={[
              styles.blob,
              { backgroundColor: blob.color, top: blob.top, left: blob.left },
            ]}
          />
        ))}
      </View>
      <Text style={styles.word}>circles</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { flexDirection: "row", alignItems: "center", gap: 8 },
  mark: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  blob: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: radius.full,
    opacity: 0.9,
  },
  word: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1.9,
  },
});
