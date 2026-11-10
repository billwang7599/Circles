import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useFonts } from "expo-font";
import * as Linking from "expo-linking";
import { router, Stack, usePathname } from "expo-router";
import * as SystemUI from "expo-system-ui";
import { useEffect, useRef } from "react";
import { AppState, StatusBar } from "react-native";
import { isRefusal } from "../api";
import { inviteParams } from "../inviteLink";
import { useSignedIn } from "../session";
import { useTheme } from "../ui/theme";

// A link opened cold still gets Home underneath, so Back has somewhere to go.
export const unstable_settings = { anchor: "index" };

const queryClient = new QueryClient({
  // Retry only when the server could not be reached; a refusal is final.
  defaultOptions: {
    queries: { retry: (count, error) => !isRefusal(error) && count < 2 },
  },
});

// Polling pauses while the app is in the background and refetches on return.
focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener("change", (state) =>
    setFocused(state === "active"),
  );
  return () => subscription.remove();
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const { scheme, colors } = useTheme();
  const signedIn = useSignedIn();
  const url = Linking.useURL();
  const pathname = usePathname();
  const handled = useRef<string>(undefined);
  // An invite link opened while signed out waits for the sign-in, then lands.
  useEffect(() => {
    if (!signedIn || !url || handled.current === url) return;
    const params = inviteParams(Linking.parse(url));
    if (!params) return;
    // A link opened while signed in is routed natively and is already on
    // its screen: remember it, or the same URL would be replayed the next
    // time Home is reached.
    if (pathname === "/invite" || pathname.startsWith("/i/")) {
      handled.current = url;
      return;
    }
    // The protected stack lands on Home once signed in; a replace before
    // that is undone by it.
    if (pathname !== "/") return;
    handled.current = url;
    router.replace({ pathname: "/invite", params });
  }, [signedIn, url, pathname]);
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);
  useEffect(() => {
    if (!signedIn) queryClient.clear();
  }, [signedIn]);
  if (!fontsLoaded && !fontError) return null;
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar
        barStyle={scheme === "dark" ? "light-content" : "dark-content"}
      />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.foreground,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={signedIn}>
          {/* Home and an event draw their own headers of round buttons. */}
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ title: "" }} />
          <Stack.Screen name="invite" options={{ title: "" }} />
          <Stack.Screen name="i/[slug]" options={{ title: "" }} />
          <Stack.Screen
            name="events/new"
            options={{ title: "", presentation: "modal" }}
          />
          <Stack.Screen
            name="events/[eventId]"
            options={{ headerShown: false }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
