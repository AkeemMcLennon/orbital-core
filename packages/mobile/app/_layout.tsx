import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Drawer } from "expo-router/drawer";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { TamaguiProvider } from "tamagui";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { configureMobileApi } from "../src/api/config";
import { DrawerContent } from "../src/components/DrawerContent";
import { colors, layout } from "../src/theme";
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

// Web-only constraint wrapper to limit max width to 1024px
function WebConstrainedView({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flex: 1,
        maxWidth: Platform.select({
          web: layout.maxWidth.web,
          default: undefined,
        }),
        alignSelf: Platform.select({
          web: 'center' as const,
          default: undefined,
        }),
        width: '100%',
      }}
    >
      {children}
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Initialize API client on app startup
    configureMobileApi().catch((error) => {
      console.error("Failed to configure mobile API:", error);
    });
  }, []);

  return (
    <GestureHandlerRootView
      style={{
        flex: 1,
        backgroundColor: Platform.select({
          web: colors.bg,
          default: undefined,
        }),
      }}
    >
      <QueryClientProvider client={queryClient}>
        <TamaguiProvider config={tamalogui}>
          <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
          >
            <WebConstrainedView>
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
                <Drawer.Screen
                  name="contacts/import"
                  options={{
                    drawerLabel: "Import Contacts",
                    headerShown: false,
                  }}
                />
              </Drawer>
              <StatusBar style="auto" />
            </WebConstrainedView>
          </ThemeProvider>
        </TamaguiProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
