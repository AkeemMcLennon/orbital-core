import React from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthContext } from "../src/contexts/AuthContext";
import {
  colors,
  spacing,
  borderRadius,
  shadows,
  typography,
} from "../src/theme";

export default function LoginScreen() {
  const { login, isLoading, rememberMe, setRememberMe } = useAuthContext();
  const { width } = useWindowDimensions();
  const logoWidth = width - spacing.xl * 2;
  const logoHeight = logoWidth / (10792 / 6341);

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
        <Image
          source={require("../assets/images/logo.png")}
          style={{ width: logoWidth, height: logoHeight }}
        />
        <Text
          style={{
            fontSize: typography.base,
            color: colors.textSecondary,
            textAlign: "center",
            marginTop: spacing.sm,
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
          <ActivityIndicator
            color="#FFFFFF"
            style={{ marginRight: spacing.sm }}
          />
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

      {/* Remember Me */}
      <Pressable
        onPress={() => setRememberMe(!rememberMe)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: spacing.lg,
          alignSelf: "center",
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: borderRadius.sm / 2,
            borderWidth: 2,
            borderColor: rememberMe ? colors.primary : colors.textTertiary,
            backgroundColor: rememberMe ? colors.primary : "transparent",
            justifyContent: "center",
            alignItems: "center",
            marginRight: spacing.sm,
          }}
        >
          {rememberMe && (
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          )}
        </View>
        <Text style={{ fontSize: typography.sm, color: colors.textSecondary }}>
          Remember me
        </Text>
      </Pressable>
    </View>
  );
}
