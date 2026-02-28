import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Drawer } from "expo-router/drawer";
import { StatusBar } from "expo-status-bar";
import { useWindowDimensions, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TamaguiProvider } from "tamagui";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { configureMobileApi } from "../src/api/config";
import { DrawerContent } from "../src/components/DrawerContent";
import { colors } from "../src/theme";
import { tamalogui } from "../tamagui.config";

// Module level - executes on import, before RootLayout mounts
const apiReady = configureMobileApi().catch((error) => {
  console.error("Failed to configure mobile API:", error);
});

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
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 768;

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
              </View>
            </ThemeProvider>
          </TamaguiProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
