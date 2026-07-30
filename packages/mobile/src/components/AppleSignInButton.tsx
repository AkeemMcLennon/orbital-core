import React from "react";
import { Image, Text } from "react-native";
import {
  SOCIAL_BUTTON_CONTENT_HEIGHT,
  SOCIAL_BUTTON_HEIGHT,
  SocialSignInButtonFrame,
} from "./socialSignInButtonBase";

// Artwork provenance: assets/images/README.md
const APPLE_LOGO = require("../../assets/images/apple-siwa-logo.png");

/**
 * Apple's "Left-aligned - Black - Medium" artwork is 31x44 at @1x, so the width is derived
 * from the height at that ratio.
 *
 * Both dimensions are given explicitly. `height` + `aspectRatio` does not constrain an
 * <Image> that has intrinsic dimensions — it stretches to fill the row instead.
 */
const LOGO_WIDTH = SOCIAL_BUTTON_CONTENT_HEIGHT * (31 / 44);

/**
 * The HIG mandates a title font size of 43% of the button height, so that the custom
 * button keeps the same proportions as the system one. 44 * 0.43 = 18.9.
 */
const TITLE_FONT_SIZE = Math.round(SOCIAL_BUTTON_HEIGHT * 0.43);

/** Must be pure black or pure white — the HIG forbids custom logo/title colors. */
const TITLE_COLOR = "#000000";

/**
 * The HIG asks for a margin of at least 8% of the button's width between the title and the
 * trailing edge. Because the content is centred, the *actual* margin is
 * `(buttonWidth - contentWidth) / 2`, which is what has to clear 8% — this padding is only a
 * floor for the degenerate case.
 *
 * Reserving a literal `"8%"` here instead is counterproductive: it shrinks the row enough
 * that "Continue with Apple" at the mandated 19pt ellipsizes on 320pt-wide screens
 * (iPhone SE), and a truncated brand title is a worse guideline outcome — the HIG warns that
 * a custom button people can't recognise defeats the purpose — than a hair under the margin.
 * At >=340pt the centred margin is 12.9% or more; at 320pt it lands near 7%.
 */
const EDGE_PADDING = 12;

interface AppleSignInButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

/**
 * "Continue with Apple" button, built to
 * https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple
 * in the "white with outline" style.
 *
 * Custom buttons are permitted but App Review evaluates them, so the constrained bits are
 * not negotiable: the title must be one of Apple's three approved strings, the logo must be
 * Apple's own unmodified artwork (never an icon font), and logo and title must both be pure
 * black on a white button.
 */
export function AppleSignInButton({
  onPress,
  disabled,
}: AppleSignInButtonProps) {
  return (
    <SocialSignInButtonFrame
      label="Continue with Apple"
      testID="apple-signin-button"
      onPress={onPress}
      disabled={disabled}
      paddingHorizontal={EDGE_PADDING}
      // No gap: the artwork carries Apple's required logo-to-title margin as built-in
      // horizontal padding. Adding one here would double it.
      gap={0}
    >
      <Image
        source={APPLE_LOGO}
        // Content height, not button height: the artwork is fully opaque with a baked-in
        // white background, so at the full 44 it would paint over the top and bottom border
        // rows and break the outline. This fills the content box exactly — nothing cropped,
        // no vertical padding added, as the HIG requires.
        style={{
          width: LOGO_WIDTH,
          height: SOCIAL_BUTTON_CONTENT_HEIGHT,
          flexShrink: 0,
        }}
        // Any letterboxing would show the button's white fill, which is invisible only
        // because both are #FFFFFF. Revisit if this button ever goes dark.
        resizeMode="contain"
        // Without this, iOS Smart Invert recolors the glyph — exactly what the HIG prohibits.
        accessibilityIgnoresInvertColors
      />
      <Text
        // Dynamic Type would break the mandated 43% title-to-button ratio and could push the
        // title past the 8% trailing margin. Apple's own button doesn't scale either.
        allowFontScaling={false}
        numberOfLines={1}
        style={{
          fontSize: TITLE_FONT_SIZE,
          fontWeight: "500",
          color: TITLE_COLOR,
          flexShrink: 1,
        }}
      >
        Continue with Apple
      </Text>
    </SocialSignInButtonFrame>
  );
}
