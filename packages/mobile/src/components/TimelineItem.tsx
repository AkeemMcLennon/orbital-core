import React from 'react';
import { View, Text, Image } from 'react-native';
import { spacing, colors, borderRadius, shadows } from '../theme';

interface TimelineItemProps {
  contactName: string;
  avatar: string;
  time: string;
  description: string;
  type: 'interaction' | 'action' | 'event';
  isLast?: boolean;
}

export const TimelineItem: React.FC<TimelineItemProps> = ({
  contactName,
  avatar,
  time,
  description,
  type,
  isLast,
}) => {
  const avatarSize = 44;
  const lineWidth = 2;
  const lineColor = colors.border;

  const getTypeColor = (itemType: string) => {
    switch (itemType) {
      case 'interaction':
        return colors.primary;
      case 'action':
        return colors.warning;
      case 'event':
        return colors.success;
      default:
        return colors.slate;
    }
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        marginBottom: spacing.lg,
        paddingLeft: spacing.md,
      }}
    >
      {/* Timeline connector */}
      {!isLast && (
        <View
          style={{
            position: 'absolute',
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
          position: 'relative',
          marginRight: spacing.md,
          zIndex: 1,
        }}
      >
        <View
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: borderRadius.full,
            borderWidth: 3,
            borderColor: colors.card,
            backgroundColor: colors.card,
          }}
        >
          <Image
            source={{ uri: avatar }}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: borderRadius.full,
            }}
          />
        </View>
        <View
          style={{
            position: 'absolute',
            bottom: -4,
            right: -4,
            width: 12,
            height: 12,
            borderRadius: borderRadius.full,
            backgroundColor: getTypeColor(type),
            borderWidth: 2,
            borderColor: colors.card,
          }}
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
            fontWeight: '600',
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
};
