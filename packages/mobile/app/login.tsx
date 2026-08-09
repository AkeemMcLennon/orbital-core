import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type DimensionValue,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "tamagui";
import { useAuthContext } from "../src/contexts/AuthContext";
import { AppleSignInButton, GoogleSignInButton } from "../src/components";
import {
  colors,
  spacing,
  borderRadius,
  shadows,
  typography,
  inputStyle as themeInputStyle,
} from "../src/theme";

type Mode = "login" | "signup";

export default function AuthScreen() {
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithApple,
    isLoading,
    rememberMe,
    setRememberMe,
  } = useAuthContext();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setError(null);
    const err = await signInWithEmail(email.trim(), password);
    if (err) setError(err.message);
  }

  async function handleSignUp() {
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);
    const err = await signUpWithEmail(name.trim(), email.trim(), password);
    if (err) setError(err.message);
  }

  const appleButton = (
    <AppleSignInButton onPress={signInWithApple} disabled={isLoading} />
  );
  const googleButton = (
    <GoogleSignInButton onPress={signInWithGoogle} disabled={isLoading} />
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/*
          Without a cap the form stretches to the full window width on desktop web. Mirrors the
          maxWidth/alignSelf treatment in app/(main)/_layout.tsx; inert on phones.
        */}
        <View
          style={{
            width: "100%",
            maxWidth: MAX_CONTENT_WIDTH,
            alignSelf: "center",
          }}
        >
          {/* Branding */}
          <View style={{ alignItems: "center", marginBottom: spacing.xxl }}>
            {/*
              The aspect ratio has to live on this wrapper, not on the <Image>: an <Image> with
              intrinsic dimensions ignores `aspectRatio` and stretches to fill instead (same
              gotcha as AppleSignInButton/SourceCard). A View has no intrinsic size, so Yoga
              honours it, and `contain` keeps the mark undistorted when maxHeight clamps the
              box below its ratio.
            */}
            <View
              style={[
                {
                  width: "100%",
                  maxWidth: MAX_CONTENT_WIDTH,
                  aspectRatio: LOGO_ASPECT_RATIO,
                },
                // RN styles have no viewport units, so bounding the logo against the viewport
                // height is web-only. On native the maxWidth cap already keeps it far smaller
                // than the old (windowWidth - padding) sizing did.
                Platform.select({
                  web: { maxHeight: "20vh" as unknown as DimensionValue },
                }),
              ]}
            >
              <Image
                source={require("../assets/images/logo.png")}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            </View>
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

          {/* Mode toggle */}
          <Tabs
            value={mode}
            onValueChange={(v) => switchMode(v as Mode)}
            orientation="horizontal"
            flexDirection="column"
            borderRadius={borderRadius.lg}
            padding={4}
            marginBottom={spacing.lg}
            style={{ backgroundColor: colors.bgAlt }}
          >
            <Tabs.List unstyled flexDirection="row" gap={0}>
              {(["login", "signup"] as Mode[]).map((m) => (
                <Tabs.Tab
                  key={m}
                  value={m}
                  unstyled
                  flex={1}
                  paddingVertical={spacing.sm}
                  alignItems="center"
                  justifyContent="center"
                  borderRadius={borderRadius.md}
                  style={{
                    backgroundColor:
                      mode === m ? colors.primary : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: typography.sm,
                      fontWeight: "600",
                      color: mode === m ? "#FFFFFF" : colors.textSecondary,
                    }}
                  >
                    {m === "login" ? "Sign In" : "Sign Up"}
                  </Text>
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>

          {/* Form fields */}
          <View style={{ gap: spacing.sm }}>
            {mode === "signup" && (
              <TextInput
                placeholder="Full Name"
                placeholderTextColor={colors.textTertiary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                style={inputStyle}
              />
            )}

            <TextInput
              placeholder="Email"
              placeholderTextColor={colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              style={inputStyle}
            />

            <View style={{ position: "relative" }}>
              <TextInput
                placeholder="Password"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete={mode === "signup" ? "new-password" : "password"}
                textContentType={mode === "signup" ? "newPassword" : "password"}
                style={inputStyle}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                style={{
                  position: "absolute",
                  right: spacing.md,
                  top: 0,
                  bottom: 0,
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color={colors.textTertiary}
                />
              </Pressable>
            </View>

            {mode === "signup" && (
              <TextInput
                placeholder="Confirm Password"
                placeholderTextColor={colors.textTertiary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                style={inputStyle}
              />
            )}
          </View>

          {/* Error message */}
          {error ? (
            <Text
              style={{
                color: "#EF4444",
                fontSize: typography.sm,
                marginTop: spacing.sm,
                textAlign: "center",
              }}
            >
              {error}
            </Text>
          ) : null}

          {/* Primary action button */}
          <Pressable
            onPress={mode === "login" ? handleSignIn : handleSignUp}
            disabled={isLoading}
            accessibilityRole="button"
            // Without this the label is auto-derived as "<icon glyph>, Sign In",
            // which reads out a garbage glyph and collides with the mode-switch
            // tab above (also just "Sign In") under any looser match.
            accessibilityLabel={
              mode === "login"
                ? "Sign In to Orbital"
                : "Create your Orbital account"
            }
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? "#4338CA" : colors.primary,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.xl,
              borderRadius: borderRadius.lg,
              marginTop: spacing.lg,
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
                name={mode === "login" ? "log-in" : "person-add"}
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
              {isLoading
                ? mode === "login"
                  ? "Signing In..."
                  : "Creating Account..."
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </Text>
          </Pressable>

          {/* Remember Me (login only) */}
          {mode === "login" && (
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
                  borderColor: rememberMe
                    ? colors.primary
                    : colors.textTertiary,
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
              <Text
                style={{ fontSize: typography.sm, color: colors.textSecondary }}
              >
                Remember me
              </Text>
            </Pressable>
          )}

          {/* Social divider + buttons */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: spacing.xl,
              marginBottom: spacing.md,
            }}
          >
            <View
              style={{ flex: 1, height: 1, backgroundColor: colors.border }}
            />
            <Text
              style={{
                marginHorizontal: spacing.sm,
                fontSize: typography.sm,
                color: colors.textTertiary,
              }}
            >
              or continue with
            </Text>
            <View
              style={{ flex: 1, height: 1, backgroundColor: colors.border }}
            />
          </View>

          {/*
            Apple first on iOS: its HIG asks that the Sign in with Apple button be no smaller
            than other sign-in buttons and not require scrolling to reach. Both buttons are
            identical in size, and leading the list is the cheapest way to honour the rest.
          */}
          <View style={{ gap: spacing.sm }}>
            {Platform.OS === "ios" ? appleButton : googleButton}
            {Platform.OS === "ios" ? googleButton : appleButton}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Intrinsic size of assets/images/logo.png (10792x6341). */
const LOGO_ASPECT_RATIO = 10792 / 6341;

/** Width of the auth column on wide screens (desktop web, tablets). */
const MAX_CONTENT_WIDTH = 420;

const inputStyle = {
  ...themeInputStyle,
  borderRadius: borderRadius.lg,
  paddingVertical: spacing.md,
  fontSize: typography.base,
};
