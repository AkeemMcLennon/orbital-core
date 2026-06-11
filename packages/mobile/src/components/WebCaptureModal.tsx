import React, { useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { WebView } from "react-native-webview";
import { captureRef } from "react-native-view-shot";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, borderRadius } from "../theme";

interface Props {
  visible: boolean;
  url: string;
  onCaptured: (imageUri: string, mimeType: string) => void;
  onClose: () => void;
}

export function WebCaptureModal({ visible, url, onCaptured, onClose }: Props) {
  const captureViewRef = useRef<View>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  // Use state-managed source so the WebView resets to the original URL whenever
  // the modal is reopened.
  const [source, setSource] = useState({ uri: url });

  async function handleCapture() {
    setIsCapturing(true);
    try {
      const uri = await captureRef(captureViewRef, {
        format: "jpg",
        quality: 0.9,
      });
      onCaptured(uri, "image/jpeg");
    } catch (e) {
      console.warn("WebView capture failed:", e);
      Alert.alert("Capture failed", "Couldn't capture the page. Try again.");
    } finally {
      setIsCapturing(false);
    }
  }

  function handleModalShow() {
    setIsLoading(true);
    setIsCapturing(false);
    setSource({ uri: url });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onShow={handleModalShow}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Pressable onPress={onClose} style={{ marginRight: spacing.md }}>
            <Ionicons name="close" size={24} color={colors.textMain} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: colors.textMain,
              }}
            >
              Capture Page
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                marginTop: 2,
              }}
            >
              Open the page, then tap Capture Page
            </Text>
          </View>
          {isLoading && (
            <ActivityIndicator size="small" color={colors.primary} />
          )}
        </View>

        <View ref={captureViewRef} collapsable={false} style={{ flex: 1 }}>
          <WebView
            source={source}
            style={{ flex: 1 }}
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            originWhitelist={["https://*", "http://*"]}
            startInLoadingState
            renderLoading={() => (
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: colors.bg,
                }}
              >
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )}
          />
        </View>

        {/* Capture button */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Pressable
            onPress={handleCapture}
            disabled={isCapturing}
            style={{
              backgroundColor: colors.primary,
              borderRadius: borderRadius.lg,
              paddingVertical: spacing.md,
              alignItems: "center",
              opacity: isCapturing ? 0.6 : 1,
            }}
          >
            {isCapturing ? (
              <ActivityIndicator size="small" color={colors.card} />
            ) : (
              <Text
                style={{ color: colors.card, fontWeight: "600", fontSize: 14 }}
              >
                Capture Page
              </Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
