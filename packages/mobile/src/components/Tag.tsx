import ColorHash from "color-hash";
import React, { useMemo } from "react";
import { View, Text, Pressable, PixelRatio } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius } from "../theme";

const colorHashLight = new ColorHash({ lightness: 0.85, saturation: 1 });
const colorHashVivid = new ColorHash({ lightness: 0.5, saturation: 1 });
const colorHashText = new ColorHash({ lightness: 0.3, saturation: 0.9 });

// Backgrounds above this WCAG relative luminance get dark text, else white.
const LIGHT_BG_THRESHOLD = 0.45;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

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
  const lightColor = useMemo(() => colorHashLight.hex(name), [name]);
  const vividColor = useMemo(() => colorHashVivid.hex(name), [name]);
  const darkTextColor = useMemo(() => colorHashText.hex(name), [name]);
  const bg = color ?? (isDynamic ? lightColor : vividColor);
  // Text color is chosen by the background's luminance, not the tag category,
  // so any background (including an explicit color) stays legible.
  const darkText = color ? colors.textMain : darkTextColor;
  const textColor =
    relativeLuminance(bg) > LIGHT_BG_THRESHOLD ? darkText : "#FFFFFF";

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
      <Text
        style={{ fontSize: s.fontSize, fontWeight: "600", color: textColor }}
      >
        {name}
      </Text>
      {onRemove && (
        <Pressable
          onPress={onRemove}
          style={{ marginLeft: spacing.xs }}
          hitSlop={8}
        >
          <Ionicons name="close" size={s.iconSize} color={textColor} />
        </Pressable>
      )}
    </View>
  );
}
