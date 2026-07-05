import React from "react";
import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import type { FivePointScale } from "@orbital/client";
import { colors, spacing, shadows } from "../theme";

export interface ScaleOption<T extends number = number> {
  value: T;
  label: string;
  /** Render the label as an emoji glyph (larger, non-bold) instead of text. */
  isEmoji?: boolean;
  /** Spoken label for emoji segments, so screen readers don't read the raw glyph. */
  accessibilityLabel?: string;
}

interface ScaleSelectorProps<T extends number = number> {
  options: ScaleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  colorFor: (value: T) => string;
  label?: string;
}

const NODE_ROW_HEIGHT = 28;
const LINE_HEIGHT = 3;
const NODE_BASE = 16;
const NODE_SELECTED = 26;

/**
 * Shared color mapping for five-point scales: 2 green, 1 light green,
 * 0 gray, -2 red. The -1 color differs per scale (e.g. orange for contact
 * strength where "weak" isn't negative, light red for sentiment), so the
 * caller supplies it.
 */
export function fivePointColor(s: number, minusOneColor: string): string {
  if (s >= 2) return colors.success;
  if (s === 1) return colors.successLight;
  if (s === 0) return colors.textTertiary;
  if (s === -1) return minusOneColor;
  return colors.error; // -2
}

/**
 * Build the standard five-point option list: emoji at the extremes
 * (🙁 lowest, 😍 highest, with the text label spoken via accessibilityLabel)
 * and text labels for the middle three levels.
 */
export function fivePointScaleOptions(
  labels: Record<FivePointScale, string>,
): ScaleOption<FivePointScale>[] {
  return [
    { value: -2, label: "🙁", isEmoji: true, accessibilityLabel: labels[-2] },
    { value: -1, label: labels[-1] },
    { value: 0, label: labels[0] },
    { value: 1, label: labels[1] },
    { value: 2, label: "😍", isEmoji: true, accessibilityLabel: labels[2] },
  ];
}

/**
 * Connected-stepper selector for a small integer scale (e.g. contact relationship
 * strength, relationship sentiment). Reads left→right lowest→highest: a thin
 * connector line carries one colored dot per option, with the selected dot
 * enlarged (white ring + soft shadow). Every level's color is visible up front.
 * Each option column (dot + label) is a single tappable, accessible element.
 * Renders a title label above the row only when `label` is provided.
 */
export function ScaleSelector<T extends number = number>({
  options,
  value,
  onChange,
  colorFor,
  label,
}: ScaleSelectorProps<T>) {
  const handlePress = (next: T) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(next);
  };

  // Inset the connector line to the centers of the first and last columns.
  const lineInset = `${100 / (2 * options.length)}%` as const;

  return (
    <View>
      {label ? (
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: colors.textMain,
            marginBottom: spacing.sm,
          }}
        >
          {label}
        </Text>
      ) : null}

      <View>
        {/* Connector line, running dot-to-dot behind the node band */}
        <View
          style={{
            position: "absolute",
            left: lineInset,
            right: lineInset,
            top: (NODE_ROW_HEIGHT - LINE_HEIGHT) / 2,
            height: LINE_HEIGHT,
            borderRadius: LINE_HEIGHT / 2,
            backgroundColor: colors.border,
          }}
        />
        <View style={{ flexDirection: "row" }}>
          {options.map((opt) => {
            const isSelected = value === opt.value;
            const color = colorFor(opt.value);
            const size = isSelected ? NODE_SELECTED : NODE_BASE;
            return (
              <Pressable
                key={opt.value}
                onPress={() => handlePress(opt.value)}
                accessible
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={opt.accessibilityLabel ?? opt.label}
                style={{ flex: 1, alignItems: "center" }}
              >
                {/* Fixed-height node band keeps dots centered on the line */}
                <View
                  style={{
                    height: NODE_ROW_HEIGHT,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      width: size,
                      height: size,
                      borderRadius: size / 2,
                      backgroundColor: color,
                      borderWidth: isSelected ? 3 : 2,
                      borderColor: colors.card,
                      ...(isSelected ? shadows.sm : null),
                    }}
                  />
                </View>
                <Text
                  importantForAccessibility="no"
                  numberOfLines={1}
                  style={{
                    marginTop: spacing.xs,
                    fontSize: opt.isEmoji ? 18 : 10,
                    fontWeight: isSelected && !opt.isEmoji ? "700" : "400",
                    color: isSelected ? colors.textMain : colors.textSecondary,
                    textAlign: "center",
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
