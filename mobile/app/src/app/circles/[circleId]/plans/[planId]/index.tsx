import { router, Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useCircle, usePlan } from "../../../../../api";
import { formatWindow } from "../../../../../dates";
import { Avatar } from "../../../../../ui/Avatar";
import { Button } from "../../../../../ui/Button";
import { Empty } from "../../../../../ui/Empty";
import { ListRow } from "../../../../../ui/ListRow";
import { Screen } from "../../../../../ui/Screen";
import { StatusBadge } from "../../../../../ui/StatusBadge";
import { Text } from "../../../../../ui/Text";
import { space } from "../../../../../ui/theme";

export default function Plan() {
  const { circleId, planId } = useLocalSearchParams<{
    circleId: string;
    planId: string;
  }>();
  const plan = usePlan(circleId, planId);
  const myId = useCircle(circleId).data?.me.id;
  const view = plan.data;

  return (
    <Screen>
      <Stack.Screen
        options={
          view
            ? {
                headerTitle: () => (
                  <View style={styles.header}>
                    <Text variant="heading" numberOfLines={1}>
                      {view.plan.title}
                    </Text>
                    <StatusBadge status={view.plan.status} />
                  </View>
                ),
              }
            : { title: "" }
        }
      />
      {plan.isPending ? (
        <ActivityIndicator />
      ) : plan.isError ? (
        <Text color="danger">{plan.error.message}</Text>
      ) : (
        <>
          <View style={styles.details}>
            <Text>{plan.data.plan.area.name}</Text>
            <Text color="textMuted">
              {formatWindow(
                plan.data.plan.windowStart,
                plan.data.plan.windowEnd,
              )}
            </Text>
          </View>
          <View style={styles.section}>
            <Text variant="heading">Who&apos;s in</Text>
            <View>
              {plan.data.members.map((member) => (
                <ListRow
                  key={member.id}
                  lead={
                    <Avatar name={member.name} outlined={!member.registered} />
                  }
                  title={member.name}
                  trailing={
                    member.id === myId ? (
                      <Button
                        title={
                          plan.data.me.registration
                            ? "Edit your inputs"
                            : "Add your inputs"
                        }
                        variant={
                          plan.data.me.registration ? "secondary" : "primary"
                        }
                        onPress={() =>
                          router.push(
                            `/circles/${circleId}/plans/${planId}/register`,
                          )
                        }
                      />
                    ) : member.registered && !member.attending ? (
                      "Can't make it"
                    ) : undefined
                  }
                />
              ))}
            </View>
          </View>
          <View style={styles.section}>
            <Text variant="heading">Options</Text>
            <Empty icon="map-pin" text="No options yet" />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: space.sm },
  details: { gap: space.xs },
  section: { gap: space.md },
});
