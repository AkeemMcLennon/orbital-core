import React from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { FaceAvatar } from "./FaceAvatar";
import { TimelineItem } from "./TimelineItem";
import { RelationshipsSection } from "./RelationshipsSection";
import { Tag } from "./Tag";
import { colors, spacing, borderRadius, shadows } from "../theme";
import { getSocialLinkMeta } from "../utils/socialLinks";
import { SocialLinkIcon } from "./SocialLinkIcon";
import { useAvatarUpload } from "../hooks/useAvatarUpload";

interface ContactDetailsProps {
  id: string;
  name: string;
  role: string;
  avatar: string;
  notes?: string;
  interactions?: Array<{
    id: string;
    date: string;
    description: string;
  }>;
  email?: string;
  phone?: string;
  tags?: Array<{
    id: string;
    name: string;
    color: string | null;
    isDynamic: boolean;
  }>;
  links?: Array<{ id: string; type: string; value: string }>;
}

export function ContactDetails({
  id,
  name,
  role,
  avatar,
  notes = "No notes yet.",
  interactions = [],
  email,
  phone,
  tags = [],
  links = [],
}: ContactDetailsProps) {
  const router = useRouter();
  const { onEdit, isUploading } = useAvatarUpload(id);

  const handleCall = () => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      alert("No phone number available");
    }
  };

  const handleMessage = () => {
    if (phone) {
      Linking.openURL(`sms:${phone}`);
    } else {
      alert("No phone number available");
    }
  };

  const handleEmail = () => {
    if (email) {
      Linking.openURL(`mailto:${email}`);
    } else {
      alert("No email address available");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottomColor: colors.border,
            borderBottomWidth: 1,
          }}
        >
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.textMain} />
          </Pressable>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: colors.textMain,
            }}
          >
            Contact Details
          </Text>
          <Link href={`/contacts/${id}/edit`} asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit contact"
            >
              <Ionicons name="pencil" size={20} color={colors.textMain} />
            </Pressable>
          </Link>
        </View>

        {/* Hero Section */}
        <View
          style={{
            alignItems: "center",
            paddingVertical: spacing.xl,
            paddingHorizontal: spacing.lg,
            borderBottomColor: colors.border,
            borderBottomWidth: 1,
            backgroundColor: colors.card,
          }}
        >
          <FaceAvatar
            name={name}
            avatar={avatar}
            size={100}
            editable
            onEdit={onEdit}
            isLoading={isUploading}
            showLabel={false}
            noMargin
          />

          <Text
            style={{
              fontSize: 28,
              fontWeight: "800",
              color: colors.textMain,
              marginBottom: spacing.xs,
            }}
          >
            {name}
          </Text>

          <Text
            style={{
              fontSize: 16,
              color: colors.textSecondary,
              marginBottom: spacing.lg,
            }}
          >
            {role}
          </Text>

          {/* Action Buttons */}
          <View
            style={{
              flexDirection: "row",
              gap: spacing.lg,
            }}
          >
            <Pressable
              onPress={handleCall}
              style={{
                width: 48,
                height: 48,
                borderRadius: borderRadius.full,
                backgroundColor: colors.primary,
                justifyContent: "center",
                alignItems: "center",
                ...shadows.md,
              }}
            >
              <Ionicons name="call" size={24} color={colors.card} />
            </Pressable>

            <Pressable
              onPress={handleMessage}
              style={{
                width: 48,
                height: 48,
                borderRadius: borderRadius.full,
                backgroundColor: colors.primary,
                justifyContent: "center",
                alignItems: "center",
                ...shadows.md,
              }}
            >
              <Ionicons name="chatbubble" size={24} color={colors.card} />
            </Pressable>

            <Pressable
              onPress={handleEmail}
              style={{
                width: 48,
                height: 48,
                borderRadius: borderRadius.full,
                backgroundColor: colors.primary,
                justifyContent: "center",
                alignItems: "center",
                ...shadows.md,
              }}
            >
              <Ionicons name="mail" size={24} color={colors.card} />
            </Pressable>
          </View>

          {/* Social Links */}
          {links.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.md,
                marginTop: spacing.lg,
                justifyContent: "center",
              }}
            >
              {links.map((link) => {
                const meta = getSocialLinkMeta(link.type);
                return (
                  <Pressable
                    key={link.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${link.type} profile`}
                    onPress={() => {
                      const target = meta.getUrl(link.value);
                      // A bare "website" handle ("acme.com") has no scheme;
                      // openURL needs one or it silently no-ops.
                      const withScheme = /^[a-z][\w+.-]*:\/\//i.test(target)
                        ? target
                        : `https://${target}`;
                      Linking.openURL(withScheme).catch(() =>
                        alert("Couldn't open this link"),
                      );
                    }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: borderRadius.full,
                      backgroundColor: colors.card,
                      justifyContent: "center",
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: colors.border,
                      ...shadows.sm,
                    }}
                  >
                    <SocialLinkIcon type={link.type} size={22} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Tags Section */}
        {tags.length > 0 && (
          <View
            style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 1,
                color: colors.textSecondary,
                marginBottom: spacing.md,
              }}
            >
              Tags
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.xs,
              }}
            >
              {tags.map((tag) => (
                <Tag
                  key={tag.id}
                  name={tag.name}
                  isDynamic={tag.isDynamic}
                  color={tag.color}
                />
              ))}
            </View>
          </View>
        )}

        {/* Notes Section */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 1,
              color: colors.textSecondary,
              marginBottom: spacing.md,
            }}
          >
            Notes
          </Text>

          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: borderRadius.lg,
              borderColor: colors.border,
              borderWidth: 1,
              padding: spacing.md,
              ...shadows.sm,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                lineHeight: 20,
                color: colors.textSecondary,
              }}
            >
              {notes}
            </Text>
          </View>
        </View>

        {/* Relationships Section */}
        <RelationshipsSection contactId={id} contactName={name} />

        {/* History Section */}
        {interactions.length > 0 && (
          <View style={{ marginTop: spacing.xl }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 1,
                color: colors.textSecondary,
                marginBottom: spacing.md,
                paddingHorizontal: spacing.lg,
              }}
            >
              History
            </Text>

            <View style={{ paddingHorizontal: spacing.lg }}>
              {interactions.map((interaction, index) => (
                <TimelineItem
                  key={interaction.id}
                  contactName={name}
                  avatar={avatar}
                  time={interaction.date}
                  description={interaction.description}
                  type="interaction"
                  isLast={index === interactions.length - 1}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
