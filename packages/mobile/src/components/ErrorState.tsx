import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { borderRadius, colors, spacing } from "../theme";
import { isNetworkError } from "@orbital/client";
import { toUserError } from "../utils/errors";

/**
 * Inline failure state for a failed data load.
 *
 * Plain React Native rather than Tamagui: this renders inside list/scroll
 * bodies next to the existing plain-RN loading blocks, and the Tamagui babel
 * plugin isn't configured, so Tamagui components would pay full runtime style
 * resolution on every list screen.
 */
export type ErrorStateProps = {
  /** Error to derive title/message/retryability from. */
  error?: unknown;
  title?: string;
  message?: string;
  /** Usually a query's `refetch`. Hidden when the error isn't retryable. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Single-line variant for inline sections. */
  compact?: boolean;
  /** Noun used in copy, e.g. "contact" → "This contact no longer exists." */
  noun?: string;
  testID?: string;
};

export function ErrorState({
  error,
  title,
  message,
  onRetry,
  retryLabel = "Try again",
  compact = false,
  noun,
  testID = "error-state",
}: ErrorStateProps) {
  const derived = toUserError(error, { noun });
  const heading = title ?? derived.title;
  const body = message ?? derived.message;
  // A 401/403/404 will fail identically on retry, so don't offer the action.
  const canRetry = derived.canRetry;

  // One layout for both variants: `compact` drops the icon, tightens the
  // vertical padding, and tints the heading red so it carries the error signal
  // the icon would otherwise provide.
  return (
    <View
      testID={testID}
      style={{
        paddingHorizontal: spacing.lg,
        paddingVertical: compact ? spacing.md : spacing.xl,
        alignItems: "center",
      }}
    >
      {!compact && (
        <Ionicons
          name={
            isNetworkError(error)
              ? "cloud-offline-outline"
              : "alert-circle-outline"
          }
          size={32}
          color={colors.error}
        />
      )}
      <Text
        style={{
          fontSize: compact ? 14 : 15,
          fontWeight: "600",
          color: compact ? colors.error : colors.textMain,
          marginTop: compact ? 0 : spacing.sm,
          textAlign: "center",
        }}
      >
        {heading}
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: colors.textSecondary,
          marginTop: spacing.xs,
          textAlign: "center",
          lineHeight: 18,
        }}
      >
        {body}
      </Text>
      {onRetry && canRetry && (
        <RetryButton label={retryLabel} onPress={onRetry} />
      )}
    </View>
  );
}

function RetryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID="error-state-retry"
      style={({ pressed }) => ({
        marginTop: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        backgroundColor: pressed ? colors.border : colors.primaryLight,
      })}
    >
      <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}
