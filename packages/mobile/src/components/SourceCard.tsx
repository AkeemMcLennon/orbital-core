import React from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Image,
  type ImageSourcePropType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, shadows, typography } from "../theme";

interface SourceCardProps {
  /** Ionicons glyph for the tile. Ignored when `logo` is set. */
  icon?: keyof typeof Ionicons.glyphMap;
  /**
   * Vendor logo artwork, rendered instead of `icon` on a white tile. Use this for any
   * provider whose branding guidelines forbid a redrawn or recolored mark — e.g. Google,
   * whose "G" must be the unmodified full-color artwork on a white background. See
   * assets/images/README.md.
   */
  logo?: ImageSourcePropType;
  /** Height of `logo`; defaults to the Ionicons size so the tiles stay consistent. */
  logoSize?: number;
  /** Aspect ratio of `logo` — vendor artwork is often not square. */
  logoAspectRatio?: number;
  title: string;
  description: string;
  onPress?: () => void;
  isLoading?: boolean;
  iconColor?: string;
  /** Hide the trailing chevron (e.g. non-interactive previews). */
  showChevron?: boolean;
}

/**
 * A tappable card advertising a contact-import source (device, Google, etc.).
 * Used on the import screen and reused non-interactively in the onboarding tour.
 */
export function SourceCard({
  icon,
  logo,
  logoSize = 22,
  logoAspectRatio = 1,
  title,
  description,
  onPress,
  isLoading,
  iconColor,
  showChevron = true,
}: SourceCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={isLoading || !onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.sm,
        opacity: isLoading ? 0.7 : 1,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: borderRadius.md,
          // Vendor artwork sits on white — Google's guidelines require it, and the tinted
          // primaryLight tile would violate them.
          backgroundColor: logo ? "#FFFFFF" : colors.primaryLight,
          alignItems: "center",
          justifyContent: "center",
          marginRight: spacing.md,
        }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : logo ? (
          <Image
            source={logo}
            // Both dimensions explicit: `height` + `aspectRatio` does not constrain an
            // <Image> that has intrinsic dimensions — it stretches to fill instead.
            style={{ width: logoSize * logoAspectRatio, height: logoSize }}
            resizeMode="contain"
            // Without this, iOS Smart Invert recolors the mark.
            accessibilityIgnoresInvertColors
          />
        ) : icon ? (
          <Ionicons name={icon} size={22} color={iconColor ?? colors.primary} />
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: typography.base,
            fontWeight: "600",
            color: colors.textMain,
            marginBottom: 2,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: typography.xs,
            color: colors.textSecondary,
            lineHeight: 16,
          }}
        >
          {description}
        </Text>
      </View>
      {showChevron && (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textTertiary}
        />
      )}
    </Pressable>
  );
}
