import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Drawer } from "expo-router/drawer";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { TamaguiProvider } from "tamagui";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { configureMobileApi } from "../src/api/config";
import { DrawerContent } from "../src/components/DrawerContent";
import { colors } from "../src/theme";
import { tamalogui } from "../tamagui.config";

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

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Initialize API client on app startup
    configureMobileApi();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <TamaguiProvider config={tamalogui}>
          <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
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
              drawerContent={() => <DrawerContent />}
            >
              <Drawer.Screen
                name="(tabs)"
                options={{
                  drawerLabel: "Dashboard",
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
            </Drawer>
            <StatusBar style="auto" />
          </ThemeProvider>
        </TamaguiProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
