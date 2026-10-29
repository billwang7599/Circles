import { router } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useMe } from "../api";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Empty } from "../ui/Empty";
import { ListRow } from "../ui/ListRow";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";
import { space } from "../ui/theme";

export default function Home() {
  const me = useMe();
  return (
    <Screen>
      {me.isPending ? (
        <ActivityIndicator />
      ) : me.isError ? (
        <Text color="danger">{me.error.message}</Text>
      ) : me.data.circles.length === 0 ? (
        <Empty icon="users" text="No circles yet" />
      ) : (
        <View>
          {me.data.circles.map((circle) => (
            <ListRow
              key={circle.id}
              lead={<Avatar name={circle.name} />}
              title={circle.name}
              onPress={() => router.push(`/circles/${circle.id}`)}
            />
          ))}
        </View>
      )}
      <View style={styles.actions}>
        <Button
          title="New circle"
          onPress={() => router.push("/circles/new")}
        />
        <Button
          title="Join with a code"
          variant="secondary"
          onPress={() => router.push("/join")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ actions: { gap: space.md } });
