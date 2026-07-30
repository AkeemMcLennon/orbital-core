import React from "react";
import { Pressable } from "react-native";
import { borderRadius, shadows } from "../theme";

/**
 * 44pt is the one height that satisfies both vendors: it is Google's iOS button height,
 * and Apple's PNG logo artwork is only valid in buttons 44pt tall. It also happens to be
 * Apple's minimum touch target.
 *
 * Apple's HIG additionally requires a Sign in with Apple button be "no smaller than
 * other sign-in buttons" — sharing this height between both buttons is what guarantees it.
 */
export const SOCIAL_BUTTON_HEIGHT = 44;

const SOCIAL_BUTTON_BORDER_WIDTH = 1;

/**
 * Height of the area inside the border. The Apple logo artwork is fully opaque with a
 * baked-in white background, so it must be sized to this rather than to
 * SOCIAL_BUTTON_HEIGHT — otherwise it paints over the top and bottom border rows.
 */
export const SOCIAL_BUTTON_CONTENT_HEIGHT =
  SOCIAL_BUTTON_HEIGHT - 2 * SOCIAL_BUTTON_BORDER_WIDTH;

/**
 * Mandated by Google's light-theme button spec. Apple's HIG explicitly permits changing
 * a custom button's bezel, so the Apple button reuses it to match.
 *
 * Deliberately a literal rather than `colors.border`: these are vendor-specified values
 * and must not drift if the app's design tokens change.
 */
const SOCIAL_BUTTON_STROKE = "#747775";

/** Both vendors require the mark to sit on white. Also a literal, not `colors.card`. */
const SOCIAL_BUTTON_SURFACE = "#FFFFFF";

/** Uniform whole-button dim, so neither mark is ever recolored relative to its background. */
const SOCIAL_BUTTON_DIMMED_OPACITY = 0.6;

interface SocialSignInButtonFrameProps {
  /** Visible title; doubles as the accessible label. */
  label: string;
  testID: string;
  onPress: () => void;
  disabled?: boolean;
  paddingHorizontal: number;
  gap: number;
  children: React.ReactNode;
}

/**
 * Frame shared by the Google and Apple sign-in buttons so the pair renders as identical
 * boxes. Only the frame is shared — the contents are not, because the two vendors' specs
 * disagree on logo sizing, padding model, title size and title color.
 *
 * No `overflow: "hidden"`: that would clip `shadows.sm` to nothing on iOS (RN maps it to
 * `masksToBounds`, which kills a CoreAnimation layer shadow). Nothing here needs the clip —
 * the widest logo (Apple's, 29.6pt) sits well clear of the 16pt corner radius even on a
 * 320pt-wide screen.
 */
export function SocialSignInButtonFrame({
  label,
  testID,
  onPress,
  disabled,
  paddingHorizontal,
  gap,
  children,
}: SocialSignInButtonFrameProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        height: SOCIAL_BUTTON_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: SOCIAL_BUTTON_BORDER_WIDTH,
        borderColor: SOCIAL_BUTTON_STROKE,
        borderRadius: borderRadius.lg,
        backgroundColor: SOCIAL_BUTTON_SURFACE,
        paddingHorizontal,
        gap,
        opacity: pressed || disabled ? SOCIAL_BUTTON_DIMMED_OPACITY : 1,
        ...shadows.sm,
      })}
    >
      {children}
    </Pressable>
  );
}
