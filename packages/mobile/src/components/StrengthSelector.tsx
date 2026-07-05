import React from "react";
import { View, Text } from "react-native";
import { colors, spacing, borderRadius } from "../theme";
import {
  ScaleSelector,
  fivePointColor,
  fivePointScaleOptions,
} from "./ScaleSelector";
import type { ContactStrength } from "@orbital/client";
import { ContactStrengthLabel } from "@orbital/client";

/**
 * Map a relationship-strength integer to a color. Mirrors the sentiment scale
 * used in RelationshipsSection, but the weak end (Acquaintance) is orange rather
 * than red — a weak relationship isn't negative; only "Distant" (-2) is red.
 */
function strengthColor(s: number): string {
  return fivePointColor(s, colors.warning);
}

/** Map a strength integer to its label (defaults to "Neutral" if out of range). */
function strengthLabel(s: number): string {
  return ContactStrengthLabel[s as ContactStrength] ?? "Neutral";
}

// Ordered weakest → strongest (left → right), emoji at the extremes.
const STRENGTH_OPTIONS = fivePointScaleOptions(ContactStrengthLabel);

interface StrengthSelectorProps {
  value: number;
  onChange: (value: number) => void;
  /** Title rendered above the row. Omit when the caller already labels this field (e.g. FormField). */
  label?: string;
}

/**
 * Color-coded connected-stepper for picking a contact's relationship strength.
 * Same visual language as the relationship sentiment picker in RelationshipsSection.
 */
export function StrengthSelector({
  value,
  onChange,
  label,
}: StrengthSelectorProps) {
  return (
    <ScaleSelector
      options={STRENGTH_OPTIONS}
      value={value as ContactStrength}
      onChange={onChange}
      colorFor={strengthColor}
      label={label}
    />
  );
}

interface StrengthBadgeProps {
  value: number;
}

/** Small colored dot + label showing a contact's relationship strength. */
export function StrengthBadge({ value }: StrengthBadgeProps) {
  const color = strengthColor(value);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        alignSelf: "flex-start",
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: color,
        backgroundColor: `${color}15`,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
        }}
      />
      <Text style={{ fontSize: 12, fontWeight: "600", color }}>
        {strengthLabel(value)}
      </Text>
    </View>
  );
}
