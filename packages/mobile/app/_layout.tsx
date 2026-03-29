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
import { router } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useWindowDimensions, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TamaguiProvider } from "tamagui";
import { getContacts, getMemoryReps } from "@orbital/client";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { configureMobileApi } from "../src/api/config";
import { DrawerContent } from "../src/components/DrawerContent";
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
  anchor: "(tabs)",
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
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 768;
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
  }, [isReady, isAuthenticated]);

  if (!isReady) return null;

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <View
      style={{
        flex: 1,
        maxWidth: isWideScreen ? 1024 : undefined,
        alignSelf: isWideScreen ? "center" : undefined,
        width: "100%",
      }}
    >
      <Drawer
        screenOptions={{
          drawerStyle: {
            backgroundColor: colors.bg,
            width: 280,
          },
          drawerLabelStyle: {
            marginLeft: -16,
          },
          headerShown: false,
          drawerActiveTintColor: colors.primary,
          drawerInactiveTintColor: colors.textSecondary,
        }}
        drawerContent={DrawerContent}
      >
        <Drawer.Screen
          name="(tabs)"
          options={{
            drawerLabel: "Dashboard",
            headerShown: false,
          }}
        />
        <Drawer.Screen
          name="contacts/index"
          options={{
            drawerLabel: "Contacts",
            headerShown: false,
          }}
        />
        <Drawer.Screen
          name="contact-add"
          options={{
            drawerLabel: "Add Contact",
            headerShown: false,
          }}
        />
        <Drawer.Screen
          name="contacts/import"
          options={{
            drawerLabel: "Import Contacts",
            headerShown: false,
          }}
        />
        <Drawer.Screen
          name="settings"
          options={{
            drawerItemStyle: { display: "none" },
            headerShown: false,
          }}
        />
        <Drawer.Screen
          name="developer-options"
          options={{
            drawerItemStyle: { display: "none" },
            headerShown: false,
          }}
        />
        <Drawer.Screen
          name="login"
          options={{
            drawerItemStyle: { display: "none" },
            headerShown: false,
          }}
        />
      </Drawer>
      <StatusBar style="auto" />
    </View>
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
