import { ActivityIndicator } from "react-native";
import { useMe } from "../api";
import { Profile } from "../home/Profile";
import { ErrorState } from "../ui/ErrorState";
import { Screen } from "../ui/Screen";

export default function ProfileScreen() {
  const me = useMe();
  return (
    <Screen>
      {me.data ? (
        <Profile me={me.data} />
      ) : me.isError ? (
        <ErrorState message={me.error.message} onRetry={() => me.refetch()} />
      ) : (
        <ActivityIndicator />
      )}
    </Screen>
  );
}
