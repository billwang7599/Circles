import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { baseUrl, useCircle } from "../../../api";
import { formatWindow } from "../../../dates";
import { Avatar } from "../../../ui/Avatar";
import { Button } from "../../../ui/Button";
import { Card } from "../../../ui/Card";
import { Empty } from "../../../ui/Empty";
import { ListRow } from "../../../ui/ListRow";
import { Screen } from "../../../ui/Screen";
import { StatusBadge } from "../../../ui/StatusBadge";
import { Text } from "../../../ui/Text";
import { space } from "../../../ui/theme";

export default function Circle() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>();
  const circle = useCircle(circleId);
  const [copied, setCopied] = useState(false);

  async function share(joinCode: string) {
    const origin = Platform.OS === "web" ? window.location.origin : baseUrl;
    const link = `${origin}/join?code=${joinCode}`;
    if (Platform.OS !== "web") {
      await Share.share({ message: link });
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: circle.data?.circle.name ?? "" }} />
      {circle.isPending ? (
        <ActivityIndicator />
      ) : circle.isError ? (
        <Text color="danger">{circle.error.message}</Text>
      ) : (
        <>
          <Card>
            <Text variant="display">{circle.data.circle.joinCode}</Text>
            <Button
              title={copied ? "Copied" : "Share"}
              variant="secondary"
              onPress={() => share(circle.data.circle.joinCode)}
            />
          </Card>
          <View style={styles.section}>
            <Text variant="heading">Members</Text>
            <View>
              {circle.data.members.map((member) => (
                <ListRow
                  key={member.id}
                  lead={<Avatar name={member.name} />}
                  title={member.name}
                  trailing={member.id === circle.data.me.id ? "You" : undefined}
                />
              ))}
            </View>
          </View>
          <View style={styles.section}>
            <Text variant="heading">Plans</Text>
            {circle.data.plans.length === 0 ? (
              <Empty icon="calendar" text="No plans yet" />
            ) : (
              <View>
                {circle.data.plans.map((plan) => (
                  <ListRow
                    key={plan.id}
                    lead={
                      <View>
                        <StatusBadge status={plan.status} />
                      </View>
                    }
                    title={plan.title}
                    trailing={formatWindow(plan.windowStart, plan.windowEnd)}
                    onPress={() =>
                      router.push(`/circles/${circleId}/plans/${plan.id}`)
                    }
                  />
                ))}
              </View>
            )}
            <Button
              title="New plan"
              onPress={() => router.push(`/circles/${circleId}/plans/new`)}
            />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ section: { gap: space.md } });
