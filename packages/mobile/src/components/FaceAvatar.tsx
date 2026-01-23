import React from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { spacing, colors, borderRadius } from '../theme';

interface FaceAvatarProps {
  name: string;
  avatar: string;
  isNew?: boolean;
  onPress?: () => void;
  isAddButton?: boolean;
}

export const FaceAvatar: React.FC<FaceAvatarProps> = ({
  name,
  avatar,
  isNew,
  onPress,
  isAddButton,
}) => {
  const avatarSize = 60;

  if (isAddButton) {
    return (
      <Pressable
        onPress={onPress}
        style={{
          alignItems: 'center',
          marginHorizontal: spacing.sm,
        }}
      >
        <View
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: borderRadius.full,
            backgroundColor: colors.textMain,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: colors.card,
              fontSize: 28,
              fontWeight: '600',
            }}
          >
            +
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={{
        alignItems: 'center',
        marginHorizontal: spacing.sm,
      }}
    >
      <View style={{ position: 'relative' }}>
        <Image
          source={{ uri: avatar }}
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: borderRadius.full,
            backgroundColor: colors.border,
          }}
        />
        {isNew && (
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 16,
              height: 16,
              borderRadius: borderRadius.full,
              backgroundColor: colors.success,
              borderWidth: 2,
              borderColor: colors.card,
            }}
          />
        )}
      </View>
      <Text
        style={{
          marginTop: spacing.sm,
          fontSize: 12,
          color: colors.textSecondary,
          maxWidth: avatarSize + 20,
          textAlign: 'center',
        }}
        numberOfLines={1}
      >
        {name}
      </Text>
    </Pressable>
  );
};
