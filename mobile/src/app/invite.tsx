import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { isRefusal, useClaimInvite } from "../api";
import { eventHref } from "../routes";
import { Button } from "../ui/Button";
import { ErrorState } from "../ui/ErrorState";
import { Screen } from "../ui/Screen";
import { ScreenTitle } from "../ui/ScreenTitle";
import { space } from "../ui/theme";

// Opened from the invite page's "Open in the app": the answers given there
// become this account's, and the event opens.
export default function Invite() {
  const { slug, g } = useLocalSearchParams<{ slug?: string; g?: string }>();
  const claim = useClaimInvite(slug ?? "");
  const { mutate, isIdle } = claim;
  useEffect(() => {
    if (!slug || !g || !isIdle) return;
    mutate(
      { token: g },
      { onSuccess: ({ eventId }) => router.replace(eventHref(eventId)) },
    );
  }, [slug, g, isIdle, mutate]);
  const home = () => router.replace("/");
  // A link with no token, or a refusal (claimed by someone else, answered
  // already), is final: sending the same claim again would only be refused
  // again, so the screen says so and offers the way home.
  const final =
    !slug || !g
      ? "This link doesn't work"
      : claim.error && isRefusal(claim.error)
        ? claim.error.message
        : undefined;
  return (
    <Screen>
      {final ? (
        <View style={styles.final}>
          <ScreenTitle title={final} />
          <Button title="Back to home" onPress={home} />
        </View>
      ) : claim.error ? (
        <ErrorState
          message={claim.error.message}
          onRetry={() => claim.reset()}
        />
      ) : (
        <ActivityIndicator />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  final: { gap: space.xl },
});
