import { Inter_300Light } from "@expo-google-fonts/inter/300Light";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { AppState, StatusBar } from "react-native";
import { isRefusal } from "../api";
import { useSignedIn } from "../session";
import { typeScale, useTheme } from "../ui/theme";

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

// Routes rather than overlays, so a shared /join?code= link still lands here.
const dialog = {
  presentation: "transparentModal",
  animation: "fade",
  headerShown: false,
  contentStyle: { backgroundColor: "transparent" },
} as const;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const { scheme, colors } = useTheme();
  const signedIn = useSignedIn();
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
          headerTitleAlign: "left",
          headerTitleStyle: {
            fontFamily: typeScale.heading.fontFamily,
            fontSize: typeScale.heading.fontSize,
            color: colors.foreground,
          },
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="index" options={{ title: "Circles" }} />
          <Stack.Screen
            name="defaults"
            options={{ title: "Defaults", headerShadowVisible: true }}
          />
          <Stack.Screen name="join" options={dialog} />
          <Stack.Screen name="circles/new" options={dialog} />
          <Stack.Screen
            name="circles/[circleId]/index"
            options={{ title: "" }}
          />
          <Stack.Screen
            name="circles/[circleId]/plans/[planId]/index"
            options={{ title: "" }}
          />
          <Stack.Screen
            name="circles/[circleId]/plans/new"
            options={{ title: "" }}
          />
          <Stack.Screen
            name="circles/[circleId]/plans/[planId]/register"
            options={{ title: "" }}
          />
          <Stack.Screen
            name="circles/[circleId]/plans/[planId]/edit"
            options={{ title: "" }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
