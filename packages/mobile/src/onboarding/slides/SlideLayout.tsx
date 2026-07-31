import React, { useRef, useState } from "react";
import { LayoutChangeEvent, ScrollView, View, Text } from "react-native";
import { colors, spacing, typography } from "../../theme";
import { useResponsivePreviewSpacing } from "../useResponsivePreviewSpacing";

/** Sub-pixel layout rounding tolerance when comparing content to viewport. */
const OVERFLOW_EPSILON = 1;

interface SlideLayoutProps {
  title: string;
  subtitle: string;
  /** Visual preview area, typically composed from real app components. */
  children: React.ReactNode;
  /**
   * Gap between the preview and the title. Defaults to a height-relative gap
   * (see useResponsivePreviewSpacing) so previews stay inside the screen on
   * shorter devices; pass a number to override.
   */
  previewSpacing?: number;
}

/**
 * Shared frame for an onboarding slide: a preview area above title + subtitle.
 *
 * Scrolls instead of clipping when a slide's preview is taller than the screen
 * (e.g. a short device or a preview with several stacked cards) — but *only*
 * then. On iOS a nested vertical scroll view with the default
 * `alwaysBounceVertical` rubber-bands even when the content fits, and claims
 * diagonal pans that should page the carousel horizontally, so scrolling stays
 * off until the content genuinely overflows.
 */
export function SlideLayout({
  title,
  subtitle,
  children,
  previewSpacing,
}: SlideLayoutProps) {
  const responsivePreviewSpacing = useResponsivePreviewSpacing();
  const viewportHeight = useRef(0);
  const contentHeight = useRef(0);
  const [overflows, setOverflows] = useState(false);

  // The two measurements arrive independently, and a resize can change only
  // the viewport (onContentSizeChange doesn't re-fire), so always re-derive
  // from the latest of each.
  const syncOverflow = () => {
    setOverflows(
      contentHeight.current > viewportHeight.current + OVERFLOW_EPSILON,
    );
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    viewportHeight.current = event.nativeEvent.layout.height;
    syncOverflow();
  };

  // Reported from the content container's own layout, so this height includes
  // the contentContainerStyle padding — directly comparable to the viewport.
  const handleContentSizeChange = (_width: number, height: number) => {
    contentHeight.current = height;
    syncOverflow();
  };

  return (
    <ScrollView
      onLayout={handleLayout}
      onContentSizeChange={handleContentSizeChange}
      scrollEnabled={overflows}
      // Don't bounce (and don't claim the pager's gesture) when the content
      // already fits; bouncing still works once it really scrolls.
      alwaysBounceVertical={false}
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
          marginBottom: previewSpacing ?? responsivePreviewSpacing,
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
