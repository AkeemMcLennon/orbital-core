import React, { useEffect } from "react";
import {
  Toast,
  ToastProvider,
  ToastViewport,
  useToastController,
  useToastState,
} from "@tamagui/toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setToastHandler } from "../utils/toast-ref";

/**
 * Registers the imperative toast controller so `notify.ts` can raise toasts
 * from outside React (service helpers, catch blocks, react-query callbacks).
 */
function ToastBridge() {
  const controller = useToastController();

  useEffect(() => {
    setToastHandler(({ title, message, kind }) => {
      controller.show(title, { message, customData: { kind } });
    });
    return () => setToastHandler(null);
  }, [controller]);

  return null;
}

function CurrentToast() {
  const toast = useToastState();
  if (!toast || toast.isHandledNatively) return null;

  const kind = (toast.customData as { kind?: string } | undefined)?.kind;
  // Tamagui tokens, not raw hex: the config sets `allowedStyleValues:
  // 'somewhat-strict'`, which rejects arbitrary strings for color props.
  // tamagui.config.ts defines these with the same values as src/theme.ts.
  const accent = kind === "success" ? "$success" : "$error";

  return (
    <Toast
      key={toast.id}
      duration={toast.duration}
      enterStyle={{ opacity: 0, scale: 0.95, y: -12 }}
      exitStyle={{ opacity: 0, scale: 0.95, y: -12 }}
      y={0}
      opacity={1}
      scale={1}
      animation="quick"
      backgroundColor="$card"
      borderLeftWidth={4}
      borderLeftColor={accent}
      borderRadius={12}
      paddingHorizontal={16}
      paddingVertical={12}
      marginHorizontal={16}
      shadowColor="#000"
      shadowOpacity={0.12}
      shadowRadius={12}
      shadowOffset={{ width: 0, height: 4 }}
      elevation={4}
    >
      <Toast.Title color="$textMain" fontWeight="600" fontSize={15}>
        {toast.title}
      </Toast.Title>
      {!!toast.message && (
        <Toast.Description color="$textSecondary" fontSize={13}>
          {toast.message}
        </Toast.Description>
      )}
    </Toast>
  );
}

/**
 * Mounts the toast stack. Must sit inside TamaguiProvider (Toast is a Tamagui
 * overlay primitive, consistent with the existing Dialog/Sheet usage).
 */
export function ToastHost({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <ToastProvider swipeDirection="up" duration={4000}>
      {/* Before children: sibling effects run in tree order, so the bridge
          must register its handler before any child mount effect can raise a
          toast (otherwise that first toast falls back to Alert). */}
      <ToastBridge />
      {children}
      <CurrentToast />
      <ToastViewport top={insets.top + 8} left={0} right={0} />
    </ToastProvider>
  );
}
