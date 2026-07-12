import React from "react";
import { View, Text } from "react-native";
import { FaceAvatar } from "../../components/FaceAvatar";
import {
  colors,
  spacing,
  borderRadius,
  shadows,
  typography,
} from "../../theme";
import { SlideLayout } from "./SlideLayout";

const EXAMPLE_NOTE =
  "Met at the product meetup downtown. Works in growth at a fintech startup, previously at Stripe. Has a golden retriever named Biscuit. Follow up about the podcast recommendation.";

/**
 * Notes slide: shows the real Notes card pattern from the contact detail
 * screen (see ContactDetails.tsx) with an example note, demonstrating that
 * every contact can carry context from the people you meet and interact with.
 */
export function NotesSlide() {
  return (
    <SlideLayout
      title="Remember the details"
      subtitle="Jot down notes about the people you meet — what you talked about, how you know them, what matters to them."
    >
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: borderRadius.xl,
          padding: spacing.lg,
          ...shadows.md,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: spacing.md,
          }}
        >
          <FaceAvatar
            name="Jordan Blake"
            size={44}
            showLabel={false}
            noMargin
          />
          <Text
            style={{
              marginLeft: spacing.sm,
              fontSize: typography.base,
              fontWeight: "600",
              color: colors.textMain,
            }}
          >
            Jordan Blake
          </Text>
        </View>

        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 1,
            color: colors.textSecondary,
            marginBottom: spacing.sm,
          }}
        >
          Notes
        </Text>
        <View
          style={{
            backgroundColor: colors.bg,
            borderRadius: borderRadius.lg,
            borderColor: colors.border,
            borderWidth: 1,
            padding: spacing.md,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              lineHeight: 20,
              color: colors.textSecondary,
            }}
          >
            {EXAMPLE_NOTE}
          </Text>
        </View>
      </View>
    </SlideLayout>
  );
}
