import React from "react";
import { Pressable, Text, View } from "react-native";

import { FaceAvatar } from "./FaceAvatar";
import { Tag } from "./Tag";
import { colors, spacing } from "../theme";

export function ContactRow({
  name,
  subtitle,
  avatar,
  tags,
  onPress,
}: {
  name: string;
  subtitle?: string | null;
  avatar?: string | null;
  // Optional chips shown under the name — used by search to surface matched tags.
  tags?: string[];
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.card,
        gap: spacing.md,
      }}
    >
      <FaceAvatar
        name={name}
        avatar={avatar ?? undefined}
        size={40}
        showLabel={false}
        noMargin
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontSize: 15, fontWeight: "500", color: colors.textMain }}
          numberOfLines={1}
        >
          {name}
        </Text>
        {!!subtitle && (
          <Text
            style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
        {!!tags?.length && (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.xs,
              marginTop: spacing.xs,
            }}
          >
            {tags.map((tag) => (
              <Tag key={tag} name={tag} size="small" />
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
}
