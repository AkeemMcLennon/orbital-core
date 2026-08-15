import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { borderRadius, colors, spacing } from "../theme";

/**
 * "Nothing here yet" state, distinct from <ErrorState /> on purpose.
 *
 * Several screens currently render an empty list when a request FAILS, which
 * reads as "you have no data" rather than "we couldn't load your data". Having
 * both states as separate components keeps that distinction explicit.
 */
export type EmptyStateProps = {
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  action?: { label: string; onPress: () => void };
  testID?: string;
};

export function EmptyState({
  title,
  message,
  icon = "file-tray-outline",
  action,
  testID = "empty-state",
}: EmptyStateProps) {
  return (
    <View
      testID={testID}
      style={{
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xl,
        alignItems: "center",
      }}
    >
      <Ionicons name={icon} size={32} color={colors.textTertiary} />
      <Text
        style={{
          fontSize: 15,
          fontWeight: "600",
          color: colors.textMain,
          marginTop: spacing.sm,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {!!message && (
        <Text
          style={{
            fontSize: 13,
            color: colors.textSecondary,
            marginTop: spacing.xs,
            textAlign: "center",
            lineHeight: 18,
          }}
        >
          {message}
        </Text>
      )}
      {action && (
        <Pressable
          onPress={action.onPress}
          testID="empty-state-action"
          style={({ pressed }) => ({
            marginTop: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.full,
            backgroundColor: pressed ? colors.border : colors.primaryLight,
          })}
        >
          <Text
            style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}
          >
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
