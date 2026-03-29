import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TamaguiProvider } from "tamagui";
import { getContacts, getMemoryReps } from "@orbital/client";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider, useAuthContext } from "../src/contexts/AuthContext";
import { contactKeys } from "../src/queries/contacts";
import { memoryRepKeys } from "../src/queries/memory-reps";
import { colors } from "../src/theme";
import { tamalogui } from "../tamagui.config";
import LoginScreen from "./login";

// Keep the native splash screen visible until we're ready
SplashScreen.preventAutoHideAsync();

// Module level - executes on import, before RootLayout mounts

export const unstable_settings = {
  anchor: "(main)",
};

// Initialize React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
    },
  },
});

function AuthGate() {
  const { isReady, isAuthenticated } = useAuthContext();
  const queryClient = useQueryClient();

  useEffect(() => {
    async function prepare() {
      if (!isReady) return;

      if (isAuthenticated) {
        await Promise.all([
          queryClient.prefetchQuery({
            queryKey: contactKeys.all,
            queryFn: () => getContacts({ limit: 50, offset: 0, sort: "date" }),
          }),
          queryClient.prefetchQuery({
            queryKey: memoryRepKeys.all,
            queryFn: () => getMemoryReps(),
          }),
        ]);
      }

      await SplashScreen.hideAsync();

      // Handle Android ACTION_SEND share intent: the shared text arrives as
      // the initial URL via expo-linking when the app is launched from the
      // share sheet. Route to /contact-add with the shared URL as a param.
      if (isAuthenticated) {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          const parsed = Linking.parse(initialUrl);
          // Deep link from share sheet: mobile://contact-add?url=<value>
          if (parsed.path === "contact-add" && parsed.queryParams?.url) {
            router.replace({
              pathname: "/contact-add",
              params: { url: parsed.queryParams.url as string },
            });
          }
        }
      }
    }

    prepare();
  }, [isReady, isAuthenticated, queryClient]);

  if (!isReady) return null;

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(main)" />
      <Stack.Screen name="contact-add" />
      <Stack.Screen name="contacts/[id]" />
      <Stack.Screen name="contacts/[id]/edit" />
      <Stack.Screen name="contacts/import" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="developer-options" />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView
      style={{
        flex: 1,
        backgroundColor: colors.bg,
      }}
    >
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <TamaguiProvider config={tamalogui}>
            <ThemeProvider
              value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
            >
              <AuthProvider>
                <AuthGate />
              </AuthProvider>
            </ThemeProvider>
          </TamaguiProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
