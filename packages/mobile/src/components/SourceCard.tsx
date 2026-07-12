import React from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, shadows, typography } from "../theme";

interface SourceCardProps {
  icon: keyof typeof Ionicons.glyphMap;
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
          backgroundColor: colors.primaryLight,
          alignItems: "center",
          justifyContent: "center",
          marginRight: spacing.md,
        }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name={icon} size={22} color={iconColor ?? colors.primary} />
        )}
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
