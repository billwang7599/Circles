import { nextMove } from "@circles/shared";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Icon, type IconName } from "../ui/Icon";
import { Text } from "../ui/Text";
import { radius, space, useTheme } from "../ui/theme";
import { eventLine, type AgendaItem } from "./agenda";

// Where an event I've answered stands. Figma has no state for declining.
function standing({ plan }: AgendaItem) {
  if (plan.phase.kind === "locked") return "Locked in";
  return plan.attending ? "Joined" : "Not going";
}

function Detail({ icon, text }: { icon: IconName; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.detail}>
      <Icon name={icon} size={14} color={colors.textMuted} />
      <Text color="textMuted" numberOfLines={1} style={styles.grow}>
        {text}
      </Text>
    </View>
  );
}

function EventRow({ item }: { item: AgendaItem }) {
  const { colors } = useTheme();
  const { plan, circle } = item;
  const path = `/circles/${circle.circle.id}/plans/${plan.id}` as const;
  const move = nextMove(plan);
  // Side by side, not nested: a button can't hold a button on the web.
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(path)}
        style={({ pressed }) => [styles.text, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text variant="strong" numberOfLines={2}>
          {plan.title}
        </Text>
        <View style={styles.details}>
          <Detail icon="users" text={circle.circle.name} />
          <Detail icon="calendar" text={eventLine(item)} />
        </View>
      </Pressable>
      {move === "vote" ? (
        <Button
          title="Vote"
          size="small"
          style={styles.action}
          onPress={() => router.push(path)}
        />
      ) : move === "inputs" ? (
        <Button
          title="Join"
          size="small"
          style={styles.action}
          onPress={() => router.push(`${path}/register`)}
        />
      ) : (
        <View style={styles.state}>
          {plan.attending ? (
            <Icon name="check" size={18} color={colors.textMuted} />
          ) : null}
          <Text color="textMuted">{standing(item)}</Text>
        </View>
      )}
    </View>
  );
}

export function EventList({
  title,
  items,
}: {
  title: string;
  items: AgendaItem[];
}) {
  return (
    <View style={styles.list}>
      <Text variant="listTitle" accessibilityRole="header">
        {title}
      </Text>
      <Card list>
        {items.map((item) => (
          <EventRow key={item.plan.id} item={item} />
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    minHeight: 64,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
  text: { flex: 1, gap: 2 },
  details: { gap: space.xs },
  detail: { flexDirection: "row", alignItems: "center", gap: space.inline },
  grow: { flexShrink: 1 },
  action: { borderRadius: radius.cell },
  state: { flexDirection: "row", alignItems: "center", gap: space.inline },
});
