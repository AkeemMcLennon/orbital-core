import React from "react";
import { ScrollView, View, Text } from "react-native";
import { colors, spacing, typography } from "../../theme";

interface SlideLayoutProps {
  title: string;
  subtitle: string;
  /** Visual preview area, typically composed from real app components. */
  children: React.ReactNode;
  /**
   * Gap between the preview and the title. Defaults to a fixed spacing.xl —
   * pass a computed value (e.g. relative to window height) for slides whose
   * preview should fit without scrolling on shorter screens.
   */
  previewSpacing?: number;
}

/**
 * Shared frame for an onboarding slide: a preview area above title + subtitle.
 * Scrolls instead of clipping when a slide's preview is taller than the
 * screen (e.g. a short device or a preview with several stacked cards).
 */
export function SlideLayout({
  title,
  subtitle,
  children,
  previewSpacing = spacing.xl,
}: SlideLayoutProps) {
  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: spacing.lg,
        justifyContent: "center",
        paddingVertical: spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Preview area — non-interactive so taps don't navigate. */}
      <View
        pointerEvents="none"
        style={{
          justifyContent: "center",
          marginBottom: previewSpacing,
        }}
      >
        {children}
      </View>

      <Text
        style={{
          fontSize: typography["2xl"],
          fontWeight: "700",
          color: colors.textMain,
          textAlign: "center",
          marginBottom: spacing.sm,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: typography.base,
          color: colors.textSecondary,
          textAlign: "center",
          lineHeight: 24,
        }}
      >
        {subtitle}
      </Text>
    </ScrollView>
  );
}
