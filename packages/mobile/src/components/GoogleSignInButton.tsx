import React from "react";
import { Image, Platform, Text } from "react-native";
import { typography } from "../theme";
import { SocialSignInButtonFrame } from "./socialSignInButtonBase";

// Artwork provenance: assets/images/README.md
const GOOGLE_G = require("../../assets/images/google-g-logo.png");

/** Spec'd logo height. Google forbids changing the logo's size, so this is not a token. */
const LOGO_HEIGHT = 20;

/**
 * The G bleeds to all four edges of a 200x204 file, so its aspect is not 1:1 — hence the
 * derived width rather than a square box, which would squash it by 2%. 19.61 x 20 matches
 * the 19.67 x 20.00 measured in Google's own official 188x44 button.
 *
 * Both dimensions are given explicitly. `height` + `aspectRatio` does not constrain an
 * <Image> that has intrinsic dimensions — it stretches to fill the row instead.
 */
const LOGO_WIDTH = LOGO_HEIGHT * (200 / 204);

/** Google's padding table: 16/12 on iOS, 12/10 on Android and web. */
const EDGE_PADDING = Platform.OS === "ios" ? 16 : 12;
const LOGO_GAP = Platform.OS === "ios" ? 12 : 10;

const TITLE_COLOR = "#1F1F1F";

interface GoogleSignInButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

/**
 * "Continue with Google" button, built to
 * https://developers.google.com/identity/branding-guidelines (light theme).
 *
 * The full-color G is mandatory and must not be recolored, resized, redrawn, or placed on
 * anything but white — which rules out an icon font. Do not swap the <Image> for an
 * Ionicons glyph.
 */
export function GoogleSignInButton({
  onPress,
  disabled,
}: GoogleSignInButtonProps) {
  return (
    <SocialSignInButtonFrame
      label="Continue with Google"
      testID="google-signin-button"
      onPress={onPress}
      disabled={disabled}
      paddingHorizontal={EDGE_PADDING}
      gap={LOGO_GAP}
    >
      <Image
        source={GOOGLE_G}
        style={{ width: LOGO_WIDTH, height: LOGO_HEIGHT, flexShrink: 0 }}
        resizeMode="contain"
        // Without this, iOS Smart Invert recolors the G — exactly what Google prohibits.
        accessibilityIgnoresInvertColors
      />
      <Text
        numberOfLines={1}
        style={{
          fontSize: typography.base,
          fontWeight: "500",
          color: TITLE_COLOR,
          flexShrink: 1,
        }}
      >
        Continue with Google
      </Text>
    </SocialSignInButtonFrame>
  );
}
