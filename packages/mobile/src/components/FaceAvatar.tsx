import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { Link, RelativePathString, ExternalPathString } from "expo-router";
import { Avatar } from "tamagui";
import ColorHash from "color-hash";
import { spacing, colors, borderRadius } from "../theme";

const colorHash = new ColorHash({ lightness: 0.4 });

const getInitials = (name: string) => {
  if (!name) return "?";
  return name
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

interface FaceAvatarProps {
  name: string;
  avatar?: string;
  isNew?: boolean;
  onPress?: () => void;
  href?: RelativePathString | ExternalPathString;
  isAddButton?: boolean;
  showLabel?: boolean;
  size?: number;
  badgeColor?: string;
  borderColor?: string;
  borderWidth?: number;
  noMargin?: boolean;
}

export const FaceAvatar: React.FC<FaceAvatarProps> = ({
  name,
  avatar,
  isNew,
  onPress,
  href,
  isAddButton,
  showLabel = true,
  size = 60,
  badgeColor,
  borderColor,
  borderWidth = 0,
  noMargin = false,
}) => {
  const avatarSize = size;
  const bgColor = useMemo(() => colorHash.hex(name), [name]);
  const initials = useMemo(() => getInitials(name), [name]);

  const addButtonContent = (
    <Pressable
      onPress={onPress}
      style={{
        alignItems: "center",
        marginHorizontal: noMargin ? 0 : spacing.sm,
      }}
    >
      <View
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: borderRadius.full,
          backgroundColor: colors.textMain,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: colors.card,
            fontSize: 28,
            fontWeight: "600",
          }}
        >
          +
        </Text>
      </View>
    </Pressable>
  );

  if (isAddButton) {
    return href ? (
      <Link href={href} asChild>
        {addButtonContent}
      </Link>
    ) : (
      addButtonContent
    );
  }

  const showBadge = isNew || badgeColor;
  const effectiveBadgeColor = badgeColor || colors.success;

  const avatarContent = (
    <Pressable
      onPress={onPress}
      style={{
        alignItems: "center",
        marginHorizontal: noMargin ? 0 : spacing.sm,
      }}
    >
      <View style={{ position: "relative" }}>
        <View
          style={
            borderWidth > 0
              ? {
                  borderRadius: borderRadius.full,
                  borderWidth,
                  borderColor: borderColor || colors.card,
                  backgroundColor: borderColor || colors.card,
                }
              : undefined
          }
        >
          <Avatar circular size={avatarSize}>
            {avatar && <Avatar.Image src={avatar} />}
            <Avatar.Fallback
              delayMs={avatar ? 600 : 0}
              backgroundColor={bgColor}
              alignItems="center"
              justifyContent="center"
            >
              <Text
                style={{
                  color: "white",
                  fontWeight: "bold",
                  fontSize: Math.floor(avatarSize / 3),
                }}
              >
                {initials}
              </Text>
            </Avatar.Fallback>
          </Avatar>
        </View>
        {showBadge && (
          <View
            style={{
              position: "absolute",
              bottom: borderWidth > 0 ? -4 : 0,
              right: borderWidth > 0 ? -4 : 0,
              width: 16,
              height: 16,
              borderRadius: borderRadius.full,
              backgroundColor: effectiveBadgeColor,
              borderWidth: 2,
              borderColor: colors.card,
            }}
          />
        )}
      </View>
      {showLabel && (
        <Text
          style={{
            marginTop: spacing.sm,
            fontSize: 12,
            color: colors.textSecondary,
            maxWidth: avatarSize + 20,
            textAlign: "center",
          }}
          numberOfLines={1}
        >
          {name}
        </Text>
      )}
    </Pressable>
  );

  return href ? (
    <Link href={href} asChild>
      {avatarContent}
    </Link>
  ) : (
    avatarContent
  );
};
