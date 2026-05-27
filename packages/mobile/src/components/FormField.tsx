import React from "react";
import { View, Text } from "react-native";
import { colors, spacing } from "../theme";

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
}

export function FormField({ label, children }: FormFieldProps) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
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
      {children}
    </View>
  );
}
