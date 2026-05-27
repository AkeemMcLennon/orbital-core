import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius } from "../theme";

interface TagProps {
  name: string;
  isDynamic?: boolean;
  color?: string | null;
  onRemove?: () => void;
}

export function Tag({ name, isDynamic = false, color, onRemove }: TagProps) {
  const bg = color ?? (isDynamic ? "#EEF2FF" : colors.primary);
  const textColor = isDynamic && !color ? colors.primary : "#FFFFFF";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: bg,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "600", color: textColor }}>
        {name}
      </Text>
      {onRemove && (
        <Pressable onPress={onRemove} style={{ marginLeft: spacing.xs }} hitSlop={8}>
          <Ionicons name="close" size={12} color={textColor} />
        </Pressable>
      )}
    </View>
  );
}
