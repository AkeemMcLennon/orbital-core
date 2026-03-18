import React from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { borderRadius, colors, spacing } from "../src/theme";

export default function SettingsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text
          style={{ fontSize: 24, fontWeight: "700", color: colors.textMain }}
        >
          Settings
        </Text>
      </View>

      {/* Settings List */}
      <View style={{ paddingTop: spacing.md }}>
        <Pressable
          onPress={() => router.push("/developer-options")}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            backgroundColor: pressed ? colors.border : colors.bg,
          })}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: borderRadius.sm,
              backgroundColor: colors.primary + "20",
              alignItems: "center",
              justifyContent: "center",
              marginRight: spacing.md,
            }}
          >
            <Ionicons name="settings-outline" size={20} color={colors.primary} />
          </View>
          <Text
            style={{
              flex: 1,
              fontSize: 16,
              color: colors.textMain,
            }}
          >
            Developer Options
          </Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
