import {
  budgetRung,
  describeAvailability,
  DisplayName,
  VIBE_LABELS,
  type Me,
  type Vibe,
} from "@circles/shared";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useDefaults, useSaveName } from "../api";
import {
  setAppearance,
  useAppearance,
  type AppearanceChoice,
} from "../appearance";
import { signOut } from "../session";
import { Alert } from "../ui/Alert";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { Icon, type IconName } from "../ui/Icon";
import { Segmented } from "../ui/Segmented";
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

const notSet = "Not set";
const vibes = (list: Vibe[]) =>
  list.map((vibe) => VIBE_LABELS[vibe]).join(", ") || notSet;

function Identity({ name, color }: { name: string; color: Me["color"] }) {
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
    <Card style={styles.identityCard}>
      <View style={styles.identity}>
        <Avatar name={name} color={color} size={56} />
        <Text variant="cardTitle" numberOfLines={2} style={styles.grow}>
          {name}
        </Text>
      </View>
      <Field
        label="Display name"
        value={draft}
        onChangeText={setDraft}
        error={error ?? save.error?.message}
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={() => changed && submit()}
      />
      <View style={styles.saveRow}>
        <Button
          title="Save changes"
          onPress={submit}
          disabled={!changed}
          loading={save.isPending}
          style={styles.grow}
        />
        <Button
          title="Discard"
          variant="ghost"
          onPress={discard}
          disabled={!changed || save.isPending}
        />
      </View>
    </Card>
  );
}

function Summary({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.summary}>
      <Icon name={icon} size={20} color={colors.foreground} />
      <View style={styles.summaryText}>
        <Text color="textMuted">{label}</Text>
        <Text variant="callout">{value}</Text>
      </View>
    </View>
  );
}

function MyDefaults() {
  const defaults = useDefaults();
  const { data } = defaults;
  return (
    <Card>
      <Text variant="strong" accessibilityRole="header">
        Defaults
      </Text>
      {data ? (
        <View style={styles.summaries}>
          <Summary
            icon="wallet"
            label="Budget"
            value={data.budget ? budgetRung(data.budget).label : notSet}
          />
          <Summary
            icon="clock"
            label="Availability"
            value={describeAvailability(data.availability) || notSet}
          />
          <Summary icon="heart" label="Likes" value={vibes(data.likes)} />
          <Summary icon="ban" label="Dislikes" value={vibes(data.dislikes)} />
        </View>
      ) : defaults.isError ? (
        <View style={styles.failed}>
          <Alert title="We could not load your defaults" />
          <Button
            title="Try again"
            variant="secondary"
            loading={defaults.isFetching}
            onPress={() => void defaults.refetch()}
          />
        </View>
      ) : (
        <ActivityIndicator />
      )}
      <Button
        title="Edit defaults"
        variant="secondary"
        onPress={() => router.push("/defaults")}
      />
    </Card>
  );
}

export function Profile({ me }: { me: Me }) {
  const { colors } = useTheme();
  const appearance = useAppearance();
  return (
    <View style={styles.profile}>
      <Text variant="pageTitle" accessibilityRole="header">
        Profile
      </Text>
      {/* Keyed so a rename settles the draft to what was saved. */}
      <Identity
        key={me.displayName}
        name={me.displayName ?? ""}
        color={me.color}
      />
      <MyDefaults />
      <Card>
        <Text variant="strong" accessibilityRole="header">
          Appearance
        </Text>
        <Segmented
          options={APPEARANCE_OPTIONS}
          value={appearance}
          onChange={setAppearance}
        />
      </Card>
      <Card>
        <Text variant="strong" accessibilityRole="header">
          Account
        </Text>
        <View style={styles.email}>
          <Icon name="mail" size={16} color={colors.foreground} />
          <View style={styles.grow}>
            <Text variant="fieldLabel">{me.email}</Text>
            <Text variant="caption" color="textMuted">
              Email
            </Text>
          </View>
        </View>
        <Button
          title="Sign out"
          variant="destructive"
          icon="log-out"
          onPress={signOut}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { gap: space.lg, paddingHorizontal: space.gutter },
  identityCard: { gap: space.gutter },
  identity: { flexDirection: "row", alignItems: "center", gap: space.md },
  grow: { flex: 1 },
  saveRow: { flexDirection: "row", gap: space.sm },
  summaries: { gap: space.gutter },
  summary: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  summaryText: { flex: 1, gap: 2 },
  failed: { gap: space.md },
  email: { flexDirection: "row", alignItems: "center", gap: space.md },
});
