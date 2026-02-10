import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  SafeAreaView,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateContact } from "@orbital/client";
import { useContact, contactKeys } from "../../../src/queries/contacts";
import { colors, spacing, borderRadius, shadows } from "../../../src/theme";

export default function EditContactScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: contact, isLoading: isLoadingContacts } = useContact(id);

  // Form state
  const [name, setName] = useState(contact?.name || "");

  const [email, setEmail] = useState(contact?.email || "");
  const [phone, setPhone] = useState(contact?.phone || "");
  const [jobTitle, setJobTitle] = useState(contact?.jobTitle || "");
  const [company, setCompany] = useState(contact?.company || "");
  const [notes, setNotes] = useState(contact?.notes || "");
  const [group, setGroup] = useState(contact?.group || "");

  // Sync form state when contact data becomes available
  useEffect(() => {
    if (contact) {
      setName(contact.name || "");
      setEmail(contact.email || "");
      setPhone(contact.phone || "");
      setJobTitle(contact.jobTitle || "");
      setCompany(contact.company || "");
      setNotes(contact.notes || "");
      setGroup(contact.group || "");
    }
  }, [contact]);

  // Update mutation
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
    });
  };

  if (isLoadingContacts || !contact) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
          }}
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
        {/* Avatar Section */}
        <View
          style={{
            alignItems: "center",
            marginBottom: spacing.xl,
            paddingBottom: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Image
            source={{
              uri:
                contact?.avatarUrl ||
                `https://ui-avatars.com/api/?name=${name}&background=4F46E5&color=fff`,
            }}
            style={{
              width: 80,
              height: 80,
              borderRadius: borderRadius.full,
              marginBottom: spacing.lg,
              backgroundColor: colors.border,
            }}
          />
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: colors.textMain,
            }}
          >
            {name || "Unnamed"}
          </Text>
        </View>

        {/* Name Field */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMain,
              marginBottom: spacing.sm,
            }}
          >
            Name *
          </Text>
          <TextInput
            placeholder="Contact name"
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
            style={{
              backgroundColor: colors.card,
              borderRadius: borderRadius.md,
              borderColor: colors.border,
              borderWidth: 1,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              color: colors.textMain,
              fontSize: 14,
              ...shadows.sm,
            }}
          />
        </View>

        {/* Email Field */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMain,
              marginBottom: spacing.sm,
            }}
          >
            Email
          </Text>
          <TextInput
            placeholder="email@example.com"
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            style={{
              backgroundColor: colors.card,
              borderRadius: borderRadius.md,
              borderColor: colors.border,
              borderWidth: 1,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              color: colors.textMain,
              fontSize: 14,
              ...shadows.sm,
            }}
          />
        </View>

        {/* Phone Field */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMain,
              marginBottom: spacing.sm,
            }}
          >
            Phone
          </Text>
          <TextInput
            placeholder="+1 (555) 000-0000"
            placeholderTextColor={colors.textTertiary}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={{
              backgroundColor: colors.card,
              borderRadius: borderRadius.md,
              borderColor: colors.border,
              borderWidth: 1,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              color: colors.textMain,
              fontSize: 14,
              ...shadows.sm,
            }}
          />
        </View>

        {/* Job Title Field */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMain,
              marginBottom: spacing.sm,
            }}
          >
            Job Title
          </Text>
          <TextInput
            placeholder="e.g., Software Engineer"
            placeholderTextColor={colors.textTertiary}
            value={jobTitle}
            onChangeText={setJobTitle}
            style={{
              backgroundColor: colors.card,
              borderRadius: borderRadius.md,
              borderColor: colors.border,
              borderWidth: 1,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              color: colors.textMain,
              fontSize: 14,
              ...shadows.sm,
            }}
          />
        </View>

        {/* Company Field */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMain,
              marginBottom: spacing.sm,
            }}
          >
            Company
          </Text>
          <TextInput
            placeholder="Company name"
            placeholderTextColor={colors.textTertiary}
            value={company}
            onChangeText={setCompany}
            style={{
              backgroundColor: colors.card,
              borderRadius: borderRadius.md,
              borderColor: colors.border,
              borderWidth: 1,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              color: colors.textMain,
              fontSize: 14,
              ...shadows.sm,
            }}
          />
        </View>

        {/* Group Field */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMain,
              marginBottom: spacing.sm,
            }}
          >
            Group
          </Text>
          <TextInput
            placeholder="e.g., Friends, Colleagues"
            placeholderTextColor={colors.textTertiary}
            value={group}
            onChangeText={setGroup}
            style={{
              backgroundColor: colors.card,
              borderRadius: borderRadius.md,
              borderColor: colors.border,
              borderWidth: 1,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              color: colors.textMain,
              fontSize: 14,
              ...shadows.sm,
            }}
          />
        </View>

        {/* Notes Field */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMain,
              marginBottom: spacing.sm,
            }}
          >
            Notes
          </Text>
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: borderRadius.md,
              borderColor: colors.border,
              borderWidth: 1,
              paddingHorizontal: spacing.md,
              minHeight: 100,
              ...shadows.sm,
            }}
          >
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
        </View>
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
          {updateMutation.isPending ? (
            <ActivityIndicator
              size="small"
              color={colors.card}
              style={{ marginRight: spacing.sm }}
            />
          ) : null}
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
