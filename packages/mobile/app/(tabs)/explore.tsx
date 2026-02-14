import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  clearAuthToken,
  getAuthToken,
  setAuthToken,
} from "../../src/api/auth-helper";
import { configureMobileApi, getCurrentBaseUrl } from "../../src/api/config";
import { borderRadius, colors, shadows, spacing } from "../../src/theme";
import * as storage from "../../src/utils/storage";

const TEST_TOKEN =
  "eyJhbGciOiJSUzI1NiIsImtpZCI6InRlc3Qta2V5LTEifQ.eyJzdWIiOiJ0ZXN0LXVzZXItMDAxIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaXNzIjoiaHR0cDovL2xvY2FsaG9zdDo5OTk5LyIsImF1ZCI6InRlc3QtYXVkaWVuY2UiLCJpYXQiOjE3NjkyNzg5NDksImV4cCI6MTc2OTI4MjU0OX0.p34D2JWc-1L__FnVTjiDRQiuxH45yKAjidB3_qDUEHl21tX1EqGCwrxSSIcrS61_fgw3qx0xUZqnI9iR3ZyHl2um_aBe2Sm9CJeylcYb9NTP6IUidCK7md_fF72y2bLoPBwGokTZR5qp9JgKo-RaU6vEg6BZQWMCWFZqKiFDnvHJsbAmEceHLPzersLCC8gFYs0Xs5USgDtaJXwGLCo93iu2bDTMI7mbuGxOXDozmTskJrxLuOZy51L7lCGL0mGaf5nghm2qPBDPm-BL1YiPcphlIHXBCmpst2EXK86kVw90edZeNnzUwDS2CtWI-UHQaoWE-cTx6L_JzqjMEfvsGA";

export default function SettingsScreen() {
  const [apiUrl, setApiUrl] = useState("");
  const [currentActiveUrl, setCurrentActiveUrl] = useState("");
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const lastTapRef = React.useRef<number>(0);

  useEffect(() => {
    // Load current settings on mount
    loadCurrentSettings();
  }, []);

  const loadCurrentSettings = async () => {
    try {
      // Load custom API URL from storage
      const savedUrl = await storage.getItem("dev_api_base_url");
      setApiUrl(savedUrl || "");

      // Load the actual active URL (including fallbacks)
      const activeUrl = await getCurrentBaseUrl();
      setCurrentActiveUrl(activeUrl);

      // Load current token
      const currentToken = await getAuthToken();
      setToken(currentToken || "");

      setIsLoading(false);
    } catch (error) {
      console.error("Error loading settings:", error);
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      // Save API URL if provided
      if (apiUrl.trim()) {
        // Validate URL format
        try {
          new URL(apiUrl.trim());
          await storage.setItem("dev_api_base_url", apiUrl.trim());
        } catch {
          alert("Invalid API URL format");
          return;
        }
      } else {
        // Clear custom URL to use default
        await storage.deleteItem("dev_api_base_url");
      }

      // Save token if provided
      if (token.trim()) {
        await setAuthToken(token);
      }

      // Reconfigure API client with new settings
      await configureMobileApi();

      // Reload active URL
      const activeUrl = await getCurrentBaseUrl();
      setCurrentActiveUrl(activeUrl);

      alert("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings");
    }
  };

  const handleClearSettings = async () => {
    try {
      // Clear token
      await clearAuthToken();
      setToken("");

      // Clear custom API URL
      await storage.deleteItem("dev_api_base_url");
      setApiUrl("");

      // Reconfigure API with defaults
      await configureMobileApi();

      // Reload active URL
      const activeUrl = await getCurrentBaseUrl();
      setCurrentActiveUrl(activeUrl);

      alert("Settings cleared - using defaults");
    } catch (error) {
      console.error("Error clearing settings:", error);
      alert("Failed to clear settings");
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
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
            Dev Settings
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary,
              marginTop: spacing.sm,
            }}
          >
            Configure API connection for testing
          </Text>
        </View>

        <View
          style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.lg }}
        >
          {/* API URL Section */}
          <View style={{ marginBottom: spacing.xl }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.textMain,
                marginBottom: spacing.sm,
              }}
            >
              API Base URL
            </Text>
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: borderRadius.md,
                borderColor: colors.border,
                borderWidth: 1,
                paddingHorizontal: spacing.md,
                ...shadows.sm,
              }}
            >
              <TextInput
                placeholder="http://localhost:8787"
                placeholderTextColor={colors.textTertiary}
                value={apiUrl}
                onChangeText={setApiUrl}
                style={{
                  paddingVertical: spacing.md,
                  color: colors.textMain,
                  fontSize: 14,
                }}
              />
            </View>
            <Text
              style={{
                fontSize: 12,
                color: colors.textTertiary,
                marginTop: spacing.sm,
              }}
            >
              Leave blank to use the default Expo dev server URL
            </Text>
            {currentActiveUrl && (
              <View
                style={{
                  marginTop: spacing.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  backgroundColor: colors.primary + "15",
                  borderRadius: borderRadius.sm,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textSecondary,
                    fontWeight: "600",
                  }}
                >
                  Active URL:
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textMain,
                    fontFamily: Platform.select({
                      ios: "Menlo",
                      android: "monospace",
                    }),
                    marginTop: 2,
                  }}
                >
                  {currentActiveUrl}
                </Text>
              </View>
            )}
          </View>

          {/* JWT Token Section */}
          <View style={{ marginBottom: spacing.xl }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.textMain,
                marginBottom: spacing.sm,
              }}
            >
              JWT Token
            </Text>
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: borderRadius.md,
                borderColor: colors.border,
                borderWidth: 1,
                paddingHorizontal: spacing.md,
                ...shadows.sm,
              }}
            >
              <TextInput
                placeholder="Paste your JWT token here..."
                placeholderTextColor={colors.textTertiary}
                value={token}
                onChangeText={setToken}
                multiline
                numberOfLines={4}
                style={{
                  paddingVertical: spacing.md,
                  color: colors.textMain,
                  fontSize: 12,
                }}
              />
            </View>
            <Text
              style={{
                fontSize: 12,
                color: colors.textTertiary,
                marginTop: spacing.sm,
              }}
            >
              {token ? `Token set (${token.length} chars)` : "No token set yet"}
            </Text>
          </View>

          {/* Info Section - Double tap to use test token */}
          <Pressable
            onPress={() => {
              const now = Date.now();
              if (now - lastTapRef.current < 300) {
                setToken(TEST_TOKEN);
              }
              lastTapRef.current = now;
            }}
          >
            <View
              style={{
                backgroundColor: colors.primary + "15",
                borderLeftWidth: 4,
                borderLeftColor: colors.primary,
                borderRadius: borderRadius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                marginBottom: spacing.xl,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.textMain,
                  marginBottom: spacing.sm,
                }}
              >
                Test Token for Demo
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  lineHeight: 18,
                }}
              >
                {TEST_TOKEN}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: colors.textTertiary,
                  marginTop: spacing.sm,
                  fontStyle: "italic",
                }}
              >
                Double-tap to use this token
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View
        style={{
          flexDirection: "row",
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.lg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Pressable
          onPress={handleClearSettings}
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.error + "20",
            borderWidth: 1,
            borderColor: colors.error,
          }}
        >
          <Text
            style={{
              textAlign: "center",
              color: colors.error,
              fontWeight: "600",
            }}
          >
            Clear All
          </Text>
        </Pressable>
        <Pressable
          onPress={handleSaveSettings}
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.primary,
          }}
        >
          <Text
            style={{
              textAlign: "center",
              color: colors.card,
              fontWeight: "600",
            }}
          >
            Save Settings
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
