import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Drawer } from 'expo-router/drawer';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TamaguiProvider } from 'tamagui';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { tamalogui } from '../tamagui.config';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DrawerContent } from '../src/components/DrawerContent';
import { colors } from '../src/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={tamalogui}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
            drawerContent={(props) => <DrawerContent {...props} />}
          >
            <Drawer.Screen
              name="(tabs)"
              options={{
                drawerLabel: 'Dashboard',
                headerShown: false,
              }}
            />
            <Drawer.Screen
              name="contact-add"
              options={{
                drawerLabel: 'Add Contact',
                headerShown: false,
              }}
            />
          </Drawer>
          <StatusBar style="auto" />
        </ThemeProvider>
      </TamaguiProvider>
    </GestureHandlerRootView>
  );
}
