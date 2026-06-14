import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateContact } from "@orbital/client";
import { useContact, contactKeys } from "../../../src/queries/contacts";
import { colors, spacing, borderRadius, inputStyle } from "../../../src/theme";
import {
  FaceAvatar,
  TagEditor,
  FormField,
  SocialLinksEditor,
  type TagItem,
  type SocialLink,
} from "../../../src/components";
import { type SocialLinkType } from "../../../src/utils/socialLinks";
import { useAvatarUpload } from "../../../src/hooks/useAvatarUpload";

export default function EditContactScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: contact, isLoading } = useContact(id);

  const [name, setName] = useState(contact?.name || "");
  const [email, setEmail] = useState(contact?.email || "");
  const [phone, setPhone] = useState(contact?.phone || "");
  const [jobTitle, setJobTitle] = useState(contact?.jobTitle || "");
  const [company, setCompany] = useState(contact?.company || "");
  const [notes, setNotes] = useState(contact?.notes || "");
  const [group, setGroup] = useState(contact?.group || "");
  const [tags, setTags] = useState<TagItem[]>(
    contact?.tags?.map((t) => ({
      name: t.name,
      isDynamic: t.isDynamic,
      color: t.color,
    })) ?? [],
  );
  const [links, setLinks] = useState<SocialLink[]>(
    contact?.links?.map((l) => ({
      type: l.type as SocialLinkType,
      value: l.value,
    })) ?? [],
  );

  // Seed the form once per contact. A background refetch produces a new
  // `contact` object; re-running the setters then would discard in-progress
  // edits, so gate on the id rather than the object identity.
  const initializedId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (contact && initializedId.current !== contact.id) {
      initializedId.current = contact.id;
      setName(contact.name || "");
      setEmail(contact.email || "");
      setPhone(contact.phone || "");
      setJobTitle(contact.jobTitle || "");
      setCompany(contact.company || "");
      setNotes(contact.notes || "");
      setGroup(contact.group || "");
      setTags(
        contact.tags?.map((t) => ({
          name: t.name,
          isDynamic: t.isDynamic,
          color: t.color,
        })) ?? [],
      );
      setLinks(
        contact.links?.map((l) => ({
          type: l.type as SocialLinkType,
          value: l.value,
        })) ?? [],
      );
    }
  }, [contact]);

  const { onEdit, isUploading } = useAvatarUpload(id);

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateContact>[1]) =>
      updateContact(id || "", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
      router.back();
    },
    onError: (error) => {
      console.error("Failed to update contact:", error);
      alert("Failed to update contact. Please try again.");
    },
  });

  const handleSave = () => {
    if (!name.trim()) {
      alert("Please enter a contact name");
      return;
    }
    updateMutation.mutate({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      jobTitle: jobTitle.trim() || undefined,
      company: company.trim() || undefined,
      notes: notes.trim() || undefined,
      group: group.trim() || undefined,
      tags: tags.map((t) => t.name),
      links: links
        .filter((l) => l.value.trim())
        .map((l) => ({ type: l.type, value: l.value.trim() })),
    });
  };

  if (isLoading || !contact) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            style={{
              marginTop: spacing.lg,
              color: colors.textSecondary,
              fontSize: 14,
            }}
          >
            Loading contact...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.textMain} />
        </Pressable>
        <Text
          style={{ fontSize: 18, fontWeight: "700", color: colors.textMain }}
        >
          Edit Contact
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.lg,
        }}
      >
        {/* Avatar */}
        <View
          style={{
            alignItems: "center",
            marginBottom: spacing.xl,
            paddingBottom: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <FaceAvatar
            name={name || "Unnamed"}
            avatar={contact?.avatarUrl}
            size={80}
            editable
            onEdit={onEdit}
            isLoading={isUploading}
            showLabel={false}
            noMargin
          />
          <Text
            style={{ fontSize: 18, fontWeight: "700", color: colors.textMain }}
          >
            {name || "Unnamed"}
          </Text>
        </View>

        <FormField label="Name *">
          <TextInput
            placeholder="Contact name"
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
            style={inputStyle}
          />
        </FormField>

        <FormField label="Email">
          <TextInput
            placeholder="email@example.com"
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            style={inputStyle}
          />
        </FormField>

        <FormField label="Phone">
          <TextInput
            placeholder="+1 (555) 000-0000"
            placeholderTextColor={colors.textTertiary}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={inputStyle}
          />
        </FormField>

        <FormField label="Job Title">
          <TextInput
            placeholder="e.g., Software Engineer"
            placeholderTextColor={colors.textTertiary}
            value={jobTitle}
            onChangeText={setJobTitle}
            style={inputStyle}
          />
        </FormField>

        <FormField label="Company">
          <TextInput
            placeholder="Company name"
            placeholderTextColor={colors.textTertiary}
            value={company}
            onChangeText={setCompany}
            style={inputStyle}
          />
        </FormField>

        <FormField label="Group">
          <TextInput
            placeholder="e.g., Friends, Colleagues"
            placeholderTextColor={colors.textTertiary}
            value={group}
            onChangeText={setGroup}
            style={inputStyle}
          />
        </FormField>

        <FormField label="Tags">
          <TagEditor tags={tags} onChange={setTags} />
        </FormField>

        <FormField label="Social Links">
          <SocialLinksEditor links={links} onChange={setLinks} />
        </FormField>

        <FormField label="Notes">
          <View style={{ ...inputStyle, minHeight: 100, paddingVertical: 0 }}>
            <TextInput
              placeholder="Add notes about this person..."
              placeholderTextColor={colors.textTertiary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              style={{
                paddingVertical: spacing.md,
                color: colors.textMain,
                fontSize: 14,
              }}
            />
          </View>
        </FormField>
      </ScrollView>

      {/* Action Buttons */}
      <View
        style={{
          flexDirection: "row",
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.lg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          disabled={updateMutation.isPending}
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.border,
            opacity: updateMutation.isPending ? 0.5 : 1,
          }}
        >
          <Text
            style={{
              textAlign: "center",
              color: colors.textMain,
              fontWeight: "600",
            }}
          >
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={!name.trim() || updateMutation.isPending}
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.lg,
            backgroundColor:
              name.trim() && !updateMutation.isPending
                ? colors.primary
                : colors.border,
            opacity: !name.trim() ? 0.5 : 1,
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "row",
          }}
        >
          {updateMutation.isPending && (
            <ActivityIndicator
              size="small"
              color={colors.card}
              style={{ marginRight: spacing.sm }}
            />
          )}
          <Text
            style={{
              textAlign: "center",
              color: colors.card,
              fontWeight: "600",
            }}
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
