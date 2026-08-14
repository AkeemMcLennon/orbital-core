import React from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  Toast,
  ToastViewport,
  useToastController,
  useToastState,
} from "@tamagui/toast";
import { borderRadius, colors, shadows, spacing } from "../theme";

type ToastKind = "error" | "success";

/**
 * Transient feedback for things the user should notice but needn't dismiss —
 * a failed save, a background sync that didn't land.
 *
 * Replaces `Alert.alert` for pure notifications: an alert steals focus and
 * demands a tap for information the user can't act on, and — because this app
 * also ships to web, where `Alert.alert` is a no-op under react-native-web —
 * it showed nothing at all there. Confirmations still belong in an Alert:
 * they need the button, and they must survive over a native Modal (which
 * renders above this viewport).
 */
export function useAppToast() {
  const controller = useToastController();

  return React.useMemo(
    () => ({
      showError: (title: string, message?: string) =>
        controller.show(title, { message, customData: { kind: "error" } }),
      showSuccess: (title: string, message?: string) =>
        controller.show(title, { message, customData: { kind: "success" } }),
    }),
    [controller],
  );
}

const KIND_STYLES: Record<ToastKind, { accent: string; icon: string }> = {
  error: { accent: colors.error, icon: "alert-circle" },
  success: { accent: colors.success, icon: "checkmark-circle" },
};

/** The rendered toast. Mount once, under ToastProvider (see app/_layout.tsx). */
export function AppToasts() {
  const toast = useToastState();

  // `isHandledNatively` covers platforms where the burnt/native presenter took
  // it; rendering our own on top would double up.
  if (!toast || toast.isHandledNatively) return null;

  const kind = (toast.customData?.kind as ToastKind) ?? "error";
  const { accent, icon } = KIND_STYLES[kind] ?? KIND_STYLES.error;

  return (
    <Toast
      key={toast.id}
      duration={toast.duration}
      // Tamagui's own animation driver isn't configured in this app, so drive
      // enter/exit with plain opacity rather than a named animation.
      enterStyle={{ opacity: 0 }}
      exitStyle={{ opacity: 0 }}
      opacity={1}
      backgroundColor="transparent"
      padding={0}
    >
      <View
        // Announced as an alert so TalkBack/VoiceOver speak it without the
        // user having to find it — the visual equivalent of it just appearing.
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          backgroundColor: colors.card,
          borderRadius: borderRadius.md,
          borderLeftWidth: 3,
          borderLeftColor: accent,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          ...shadows.md,
        }}
      >
        <Ionicons
          name={icon as never}
          size={18}
          color={accent}
          style={{ marginRight: spacing.sm }}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontSize: 14, fontWeight: "600", color: colors.textMain }}
          >
            {toast.title}
          </Text>
          {!!toast.message && (
            <Text
              style={{
                marginTop: 2,
                fontSize: 13,
                color: colors.textSecondary,
              }}
            >
              {toast.message}
            </Text>
          )}
        </View>
      </View>
    </Toast>
  );
}

/** Positions toasts below the status bar, above everything else. */
export function AppToastViewport() {
  const insets = useSafeAreaInsets();

  return (
    <ToastViewport
      top={insets.top + spacing.sm}
      left={spacing.lg}
      right={spacing.lg}
    />
  );
}
