import { StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { Text } from "../ui/Text";
import { font } from "../ui/theme";
import { logoSvg } from "./logoSvg";

export function Logo() {
  return (
    <View
      style={styles.logo}
      accessible
      accessibilityRole="header"
      accessibilityLabel="Circles"
    >
      <SvgXml xml={logoSvg} width={30} height={30} />
      <Text style={styles.word}>circles</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { flexDirection: "row", alignItems: "center", gap: 7 },
  word: {
    fontFamily: font.semibold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -1.2,
  },
});
