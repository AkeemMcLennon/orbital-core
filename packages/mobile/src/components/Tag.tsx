import React from "react";
import { View, Text, Pressable, PixelRatio } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius } from "../theme";
import { getTagFill, relativeLuminance } from "../utils/tag-colors";

// Backgrounds above this WCAG relative luminance get dark text, else white.
const LIGHT_BG_THRESHOLD = 0.45;

const SIZE = {
  small: {
    fontSize: 12,
    paddingH: spacing.sm,
    paddingV: spacing.xs,
    minHeight: 28,
    iconSize: 12,
  },
  medium: {
    fontSize: 15,
    paddingH: 10,
    paddingV: 5,
    minHeight: 34,
    iconSize: 15,
  },
  large: {
    fontSize: 18,
    paddingH: Math.round(spacing.sm * 1.5),
    paddingV: Math.round(spacing.xs * 1.5),
    minHeight: 42,
    iconSize: 18,
  },
} as const;

interface TagProps {
  name: string;
  isDynamic?: boolean;
  color?: string | null;
  onRemove?: () => void;
  size?: keyof typeof SIZE;
}

export function Tag({
  name,
  isDynamic = false,
  color,
  onRemove,
  size = "small",
}: TagProps) {
  const fontScale = PixelRatio.getFontScale();
  const s = SIZE[size];
  const bg = color ?? getTagFill(name);
  // Generated fills are pinned to a lightness that clears AA against white, so
  // they need no runtime check. An explicit color can be any hex, so that branch
  // still picks its text color from the background's luminance.
  const textColor = color
    ? relativeLuminance(color) > LIGHT_BG_THRESHOLD
      ? colors.textMain
      : "#FFFFFF"
    : "#FFFFFF";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: bg,
        borderRadius: borderRadius.full,
        paddingHorizontal: Math.round(s.paddingH * fontScale),
        paddingVertical: Math.round(s.paddingV * fontScale),
        minHeight: Math.round(s.minHeight * fontScale),
      }}
    >
      {isDynamic && (
        <Ionicons
          name="sparkles"
          size={s.iconSize - 3}
          color={textColor}
          style={{ marginRight: spacing.xs }}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      )}
      <Text
        style={{ fontSize: s.fontSize, fontWeight: "600", color: textColor }}
      >
        {name}
      </Text>
      {onRemove && (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${name}`}
          style={{ marginLeft: spacing.xs }}
          hitSlop={8}
        >
          <Ionicons name="close" size={s.iconSize} color={textColor} />
        </Pressable>
      )}
    </View>
  );
}
