import { DisplayName, type Me } from "@circles/shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSaveName } from "../api";
import {
  setAppearance,
  useAppearance,
  type AppearanceChoice,
} from "../appearance";
import { isPast, todayKey } from "../dates";
import { signOut } from "../session";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { Icon, type IconName } from "../ui/Icon";
import { Section } from "../ui/Section";
import { Segmented } from "../ui/Segmented";
import { Stat } from "../ui/Stat";
import { Text } from "../ui/Text";
import { space, useTheme } from "../ui/theme";

const APPEARANCE_OPTIONS: readonly {
  id: AppearanceChoice;
  label: string;
  icon: IconName;
}[] = [
  { id: "system", label: "System", icon: "sun-moon" },
  { id: "light", label: "Light", icon: "sun" },
  { id: "dark", label: "Dark", icon: "moon-star" },
];

// The account as an event's screen opens: a kicker, the name in Display
// type, counters and the avatar where the people who are in would be.
function Hero({ me }: { me: Me }) {
  const { colors } = useTheme();
  const name = me.displayName ?? "";
  const today = todayKey();
  const upcoming = me.events.filter((event) => !isPast(event, today));
  const organizing = me.events.filter((event) => event.isOrganizer);
  return (
    <View style={styles.hero}>
      <View style={styles.titleBlock}>
        <View style={styles.kicker}>
          <Icon name="mail" size={16} color={colors.textMuted} />
          <Text
            color="textMuted"
            variant="section"
            numberOfLines={1}
            style={styles.grow}
          >
            {me.email}
          </Text>
        </View>
        <Text
          variant="display"
          accessibilityRole="header"
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={styles.name}
        >
          {name}
        </Text>
      </View>
      <View style={styles.heroMeta}>
        <Stat
          value={me.events.length}
          label={me.events.length === 1 ? "event" : "events"}
        />
        <Stat value={upcoming.length} label="upcoming" />
        <Stat value={organizing.length} label="organizing" />
        <View style={styles.grow} />
        <Avatar name={name} color={me.color} size={56} />
      </View>
    </View>
  );
}

function NameCard({ name }: { name: string }) {
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string>();
  const save = useSaveName();
  const changed = draft.trim() !== name;

  function submit() {
    const parsed = DisplayName.safeParse(draft);
    setError(parsed.success ? undefined : parsed.error.issues[0]?.message);
    if (parsed.success) save.mutate({ displayName: parsed.data });
  }

  function discard() {
    setDraft(name);
    setError(undefined);
    save.reset();
  }

  return (
    <Card>
      <Field
        label="Display name"
        value={draft}
        onChangeText={setDraft}
        error={error ?? save.error?.message}
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={() => changed && submit()}
      />
      {changed ? (
        <View style={styles.saveRow}>
          <Button
            title="Save"
            onPress={submit}
            loading={save.isPending}
            style={styles.grow}
          />
          <Button
            title="Discard"
            variant="ghost"
            onPress={discard}
            disabled={save.isPending}
          />
        </View>
      ) : null}
    </Card>
  );
}

export function Profile({ me }: { me: Me }) {
  const appearance = useAppearance();
  return (
    <View style={styles.profile}>
      <Hero me={me} />
      {/* Keyed so a rename settles the draft to what was saved. */}
      <NameCard key={me.displayName} name={me.displayName ?? ""} />
      <Section title="Appearance">
        <Segmented
          options={APPEARANCE_OPTIONS}
          value={appearance}
          onChange={setAppearance}
        />
      </Section>
      <Button
        title="Sign out"
        variant="destructive"
        icon="log-out"
        onPress={signOut}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { gap: space.xxl },
  hero: { gap: space.xl },
  // As on an event's screen: the kicker keeps its own gap from the name.
  titleBlock: { gap: space.md },
  kicker: { flexDirection: "row", alignItems: "center", gap: space.sm },
  // Display's line height sits under its size; a wrapped name needs room.
  name: { lineHeight: 56 },
  heroMeta: { flexDirection: "row", alignItems: "flex-end", gap: space.xl },
  grow: { flex: 1 },
  saveRow: { flexDirection: "row", gap: space.sm },
});
