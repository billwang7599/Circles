import { StyleSheet, View } from "react-native";
import { useMe } from "../api";
import {
  APPEARANCES,
  setAppearance,
  useAppearance,
  type AppearanceChoice,
} from "../appearance";
import { signOut } from "../session";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";
import {
  setTheme,
  space,
  THEMES,
  useThemeChoice,
  type ThemeId,
} from "../ui/theme";

const appearanceLabels: Record<AppearanceChoice, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

const themeLabels: Record<ThemeId, string> = {
  ink: "Ink",
  sand: "Sand",
  paper: "Paper",
  dawn: "Dawn",
};

export default function Settings() {
  const appearance = useAppearance();
  const theme = useThemeChoice();
  const email = useMe().data?.email;
  return (
    <Screen>
      <View style={styles.fields}>
        <View style={styles.field}>
          <Text variant="label">Theme</Text>
          <View style={styles.chips}>
            {THEMES.map((id) => (
              <Chip
                key={id}
                label={themeLabels[id]}
                selected={id === theme}
                onPress={() => setTheme(id)}
              />
            ))}
          </View>
        </View>
        <View style={styles.field}>
          <Text variant="label">Appearance</Text>
          <View style={styles.chips}>
            {APPEARANCES.map((choice) => (
              <Chip
                key={choice}
                label={appearanceLabels[choice]}
                selected={choice === appearance}
                onPress={() => setAppearance(choice)}
              />
            ))}
          </View>
        </View>
        <View style={styles.field}>
          <Text variant="label">Account</Text>
          {email ? <Text color="textMuted">Signed in as {email}</Text> : null}
          <Button title="Sign out" variant="secondary" onPress={signOut} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: space.xl },
  field: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
