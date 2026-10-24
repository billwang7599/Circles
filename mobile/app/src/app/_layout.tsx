import { Figtree_400Regular } from "@expo-google-fonts/figtree/400Regular";
import { Figtree_600SemiBold } from "@expo-google-fonts/figtree/600SemiBold";
import { Figtree_700Bold } from "@expo-google-fonts/figtree/700Bold";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { typeScale, useTheme } from "../ui/theme";

const queryClient = new QueryClient();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Figtree_400Regular,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });
  const { colors } = useTheme();
  if (!fontsLoaded && !fontError) return null;
  return (
    <QueryClientProvider client={queryClient}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.canvas },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontFamily: typeScale.heading.fontFamily,
            fontSize: typeScale.heading.fontSize,
          },
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Circles" }} />
        <Stack.Screen name="join" options={{ title: "Join" }} />
        <Stack.Screen name="circles/new" options={{ title: "New circle" }} />
        <Stack.Screen
          name="circles/[circleId]/plans/new"
          options={{ title: "New plan" }}
        />
        <Stack.Screen
          name="circles/[circleId]/plans/[planId]/register"
          options={{ title: "Your inputs" }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
