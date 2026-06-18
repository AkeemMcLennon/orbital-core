import ColorHash from "color-hash";
import { ExternalPathString, Link, RelativePathString } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Avatar } from "tamagui";
import { borderRadius, colors, spacing } from "../theme";

type BackgroundColor = React.ComponentProps<typeof Avatar>["backgroundColor"];

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
  avatar?: string | null;
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
  editable?: boolean;
  onEdit?: () => void;
  isLoading?: boolean;
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
  editable = false,
  onEdit,
  isLoading = false,
}) => {
  const avatarSize = size;
  const bgColor = useMemo(() => colorHash.hex(name), [name]);
  const initials = useMemo(() => getInitials(name), [name]);

  const addButtonContent = (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add contact"
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
      onPress={editable ? onEdit : onPress}
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
              backgroundColor={bgColor as BackgroundColor}
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
        {editable && (
          <View
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 26,
              height: 26,
              borderRadius: borderRadius.full,
              backgroundColor: colors.primary,
              justifyContent: "center",
              alignItems: "center",
              borderWidth: 2,
              borderColor: colors.card,
            }}
          >
            <Ionicons name="camera" size={13} color={colors.card} />
          </View>
        )}
        {isLoading && (
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: "rgba(0,0,0,0.4)",
              borderRadius: borderRadius.full,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <ActivityIndicator color={colors.card} />
          </View>
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
