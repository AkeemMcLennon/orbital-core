import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DrawerActions } from "@react-navigation/native";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuthContext } from "../contexts/AuthContext";
import { FaceAvatar } from "./FaceAvatar";
import { colors, spacing, borderRadius } from "../theme";

const DRAWER_ITEMS = [
  {
    id: "1",
    icon: "home",
    label: "Dashboard",
    route: "/",
  },
  {
    id: "2",
    icon: "people",
    label: "Contacts",
    route: "/contacts",
  },
  {
    id: "3",
    icon: "pricetag",
    label: "Tags",
    route: "/tags",
  },
  {
    id: "4",
    icon: "settings",
    label: "Settings",
    route: "/settings",
  },
];

export function DrawerContent({
  navigation,
  ...props
}: DrawerContentComponentProps) {
  const { signOut, user } = useAuthContext();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: spacing.lg,
          paddingHorizontal: spacing.lg,
        }}
      >
        {/* User Profile Section */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: spacing.xxl,
            paddingBottom: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ marginRight: spacing.md }}>
            <FaceAvatar
              name={user?.name || "User"}
              size={48}
              showLabel={false}
              noMargin={true}
            />
          </View>
          <View>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: colors.textMain,
              }}
            >
              {user?.name || "User"}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.textTertiary,
              }}
            >
              {user?.email || ""}
            </Text>
          </View>
        </View>

        {/* Navigation Items */}
        <View style={{ gap: spacing.md }}>
          {DRAWER_ITEMS.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              // Not the bare label: on the Contacts and Tags screens it is also
              // the header title, so "Contacts" would name two elements at once.
              accessibilityLabel={`Go to ${item.label}`}
              onPress={() => {
                router.push(item.route as any);
                navigation.dispatch(DrawerActions.closeDrawer());
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.md,
                borderRadius: borderRadius.md,
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
              }}
            >
              <Ionicons
                name={item.icon as any}
                size={20}
                color={colors.primary}
              />
              <Text
                style={{
                  marginLeft: spacing.md,
                  fontSize: 14,
                  fontWeight: "500",
                  color: colors.textMain,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Help Section */}
        <View
          style={{
            marginTop: spacing.xxl,
            paddingTop: spacing.lg,
            paddingHorizontal: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Pressable
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: spacing.md,
            }}
          >
            <Ionicons
              name="help-circle"
              size={18}
              color={colors.textTertiary}
            />
            <Text
              style={{
                marginLeft: spacing.md,
                fontSize: 13,
                color: colors.textTertiary,
              }}
            >
              Help & Support
            </Text>
          </Pressable>

          <Pressable
            onPress={() => signOut()}
            accessibilityRole="button"
            accessibilityLabel="Sign Out"
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: spacing.md,
            }}
          >
            <Ionicons name="log-out" size={18} color={colors.error} />
            <Text
              style={{
                marginLeft: spacing.md,
                fontSize: 13,
                color: colors.error,
              }}
            >
              Sign Out
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
