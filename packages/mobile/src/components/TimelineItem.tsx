import { Link, RelativePathString, ExternalPathString } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { borderRadius, colors, shadows, spacing } from "../theme";
import { FaceAvatar } from "./FaceAvatar";
interface TimelineItemProps {
  contactName: string;
  avatar?: string;
  time: string;
  description: string;
  type: "interaction" | "action" | "event";
  isLast?: boolean;
  href?: RelativePathString | ExternalPathString;
}

export const TimelineItem: React.FC<TimelineItemProps> = ({
  contactName,
  avatar,
  time,
  description,
  type,
  isLast,
  href,
}) => {
  const avatarSize = 44;
  const lineWidth = 2;
  const lineColor = colors.border;

  const getTypeColor = (itemType: string) => {
    switch (itemType) {
      case "interaction":
        return colors.primary;
      case "action":
        return colors.warning;
      case "event":
        return colors.success;
      default:
        return colors.slate;
    }
  };

  const timelineContent = (
    <View
      style={{
        flexDirection: "row",
        marginBottom: spacing.lg,
        paddingLeft: spacing.md,
      }}
    >
      {/* Timeline connector */}
      {!isLast && (
        <View
          style={{
            position: "absolute",
            left: avatarSize / 2 - lineWidth / 2,
            top: avatarSize,
            width: lineWidth,
            height: spacing.xl,
            backgroundColor: lineColor,
          }}
        />
      )}

      {/* Avatar with border */}
      <View
        style={{
          position: "relative",
          marginRight: spacing.md,
          zIndex: 1,
        }}
      >
        <FaceAvatar
          name={contactName}
          avatar={avatar}
          showLabel={false}
          size={avatarSize}
          badgeColor={getTypeColor(type)}
          borderColor={colors.card}
          borderWidth={3}
          noMargin
        />
      </View>

      {/* Content card */}
      <View
        style={{
          flex: 1,
          backgroundColor: colors.card,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          borderColor: colors.border,
          borderWidth: 1,
          ...shadows.sm,
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: colors.textMain,
            marginBottom: spacing.xs,
          }}
        >
          {contactName}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: colors.textTertiary,
            marginBottom: spacing.xs,
          }}
        >
          {time}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: colors.textSecondary,
            lineHeight: 18,
          }}
        >
          {description}
        </Text>
      </View>
    </View>
  );

  return href ? (
    <Link href={href} asChild>
      <Pressable>{timelineContent}</Pressable>
    </Link>
  ) : (
    timelineContent
  );
};
