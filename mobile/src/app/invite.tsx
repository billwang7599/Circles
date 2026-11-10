import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator } from "react-native";
import { isRefusal, useClaimInvite } from "../api";
import { eventHref } from "../routes";
import { ErrorState } from "../ui/ErrorState";
import { Screen } from "../ui/Screen";

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
  return (
    <Screen>
      {!slug || !g ? (
        <ErrorState
          message="This link doesn't work"
          onRetry={home}
          retryTitle="Back to Home"
        />
      ) : claim.error ? (
        // A refusal (claimed by someone else, answered already) is final:
        // sending the same claim again would only be refused again.
        isRefusal(claim.error) ? (
          <ErrorState
            message={claim.error.message}
            onRetry={home}
            retryTitle="Back to Home"
          />
        ) : (
          <ErrorState
            message={claim.error.message}
            onRetry={() => claim.reset()}
          />
        )
      ) : (
        <ActivityIndicator />
      )}
    </Screen>
  );
}
