import { useWindowDimensions, View } from "react-native";
import { Drawer } from "expo-router/drawer";
import { StatusBar } from "expo-status-bar";

import { DrawerContent } from "../../src/components/DrawerContent";
import { colors } from "../../src/theme";

export default function MainLayout() {
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 768;

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
          name="index"
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
      </Drawer>
      <StatusBar style="auto" />
    </View>
  );
}
