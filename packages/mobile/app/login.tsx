import React from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthContext } from "../src/contexts/AuthContext";
import { colors, spacing, borderRadius, shadows, typography } from "../src/theme";

export default function LoginScreen() {
  const { login, isLoading } = useAuthContext();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center",
        padding: spacing.xl,
      }}
    >
      {/* Branding */}
      <View style={{ alignItems: "center", marginBottom: spacing.xxl }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: borderRadius.xl,
            backgroundColor: colors.primary,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: spacing.lg,
            ...shadows.lg,
          }}
        >
          <Ionicons name="planet" size={40} color="#FFFFFF" />
        </View>
        <Text
          style={{
            fontSize: typography["3xl"],
            fontWeight: "800",
            color: colors.textMain,
            marginBottom: spacing.xs,
          }}
        >
          Orbital
        </Text>
        <Text
          style={{
            fontSize: typography.base,
            color: colors.textSecondary,
            textAlign: "center",
          }}
        >
          Your personal relationship manager
        </Text>
      </View>

      {/* Sign In Button */}
      <Pressable
        onPress={login}
        disabled={isLoading}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? "#4338CA" : colors.primary,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xl,
          borderRadius: borderRadius.lg,
          width: "100%",
          maxWidth: 320,
          opacity: isLoading ? 0.7 : 1,
          ...shadows.md,
        })}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" style={{ marginRight: spacing.sm }} />
        ) : (
          <Ionicons
            name="log-in"
            size={20}
            color="#FFFFFF"
            style={{ marginRight: spacing.sm }}
          />
        )}
        <Text
          style={{
            fontSize: typography.base,
            fontWeight: "600",
            color: "#FFFFFF",
          }}
        >
          {isLoading ? "Signing In..." : "Sign In"}
        </Text>
      </Pressable>
    </View>
  );
}
