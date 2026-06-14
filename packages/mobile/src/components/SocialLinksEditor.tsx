import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  SOCIAL_LINK_META,
  detectChannelFromUrl,
  type SocialLinkType,
} from "../utils/socialLinks";
import { PlatformSelect } from "./PlatformSelect";
import { useRowKeys } from "../hooks/useRowKeys";
import { colors, spacing, borderRadius } from "../theme";

export interface SocialLink {
  type: SocialLinkType;
  value: string;
}

interface SocialLinksEditorProps {
  links: SocialLink[];
  onChange: (links: SocialLink[]) => void;
}

export function SocialLinksEditor({ links, onChange }: SocialLinksEditorProps) {
  const { keys, addKey, removeKey } = useRowKeys(links.length);

  function update(index: number, partial: Partial<SocialLink>) {
    const next = links.map((l, i) => (i === index ? { ...l, ...partial } : l));
    onChange(next);
  }

  function remove(index: number) {
    removeKey(index);
    onChange(links.filter((_, i) => i !== index));
  }

  function add() {
    addKey();
    onChange([...links, { type: "website", value: "" }]);
  }

  return (
    <View>
      {links.map((link, i) => (
        <View
          key={keys[i]}
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: spacing.sm,
            backgroundColor: colors.card,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
          }}
        >
          <PlatformSelect
            value={link.type}
            onChange={(type) => update(i, { type })}
          />
          <TextInput
            value={link.value}
            onChangeText={(value) => {
              // Only auto-detect on a pasted URL — detecting per keystroke
              // collapses a half-typed handle and flips the platform mid-edit.
              if (/^https?:\/\//i.test(value)) {
                const detected = detectChannelFromUrl(value);
                if (detected) {
                  update(i, { type: detected.type, value: detected.value });
                  return;
                }
              }
              update(i, { value });
            }}
            placeholder={SOCIAL_LINK_META[link.type].placeholder}
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={
              link.type === "website" || link.type === "other"
                ? "url"
                : "default"
            }
            style={{
              flex: 1,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.sm,
              color: colors.textMain,
              fontSize: 14,
            }}
          />
          <Pressable
            onPress={() => remove(i)}
            style={{ paddingHorizontal: spacing.md }}
          >
            <Ionicons name="close" size={18} color={colors.textTertiary} />
          </Pressable>
        </View>
      ))}
      <Pressable
        onPress={add}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          paddingVertical: spacing.sm,
        }}
      >
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text
          style={{ fontSize: 14, color: colors.primary, fontWeight: "500" }}
        >
          Add Link
        </Text>
      </Pressable>
    </View>
  );
}
