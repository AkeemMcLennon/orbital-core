import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { FaceAvatar } from "./FaceAvatar";
import { useAppToast } from "./AppToasts";
import {
  ScaleSelector,
  fivePointColor,
  fivePointScaleOptions,
} from "./ScaleSelector";
import { colors, spacing, borderRadius, shadows } from "../theme";
import {
  useContactRelationships,
  useCreateRelationship,
  useDeleteRelationship,
} from "../queries/relationships";
import { useContactsList } from "../queries/contacts";
import type {
  ListContactRelationships200ItemsItem,
  RelationshipSentiment,
} from "@orbital/client";
import { RelationshipSentimentLabel } from "@orbital/client";

/** Map sentiment integer to a color (dislike end is light red). */
function sentimentColor(s: number): string {
  return fivePointColor(s, colors.errorLight);
}

// Ordered lowest → highest (left → right), emoji at the extremes.
const SENTIMENT_OPTIONS = fivePointScaleOptions(RelationshipSentimentLabel);

interface RelationshipsSectionProps {
  contactId: string;
  contactName: string;
}

export function RelationshipsSection({
  contactId,
  contactName,
}: RelationshipsSectionProps) {
  const router = useRouter();
  const { data: relationshipsData, isLoading } =
    useContactRelationships(contactId);
  const deleteMutation = useDeleteRelationship(contactId);
  const [showAddModal, setShowAddModal] = useState(false);
  const { showError } = useAppToast();

  const relationships = relationshipsData?.items ?? [];

  const handleDelete = (rel: ListContactRelationships200ItemsItem) => {
    Alert.alert(
      "Remove Relationship",
      `Remove "${rel.type}" relationship with ${rel.relatedContact?.name ?? "this contact"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          // mutateAsync: nothing blocks confirming a second removal while this
          // one is in flight, and react-query drops a mutate call's callbacks
          // once a newer call supersedes it — the promise is retained per call.
          onPress: () =>
            deleteMutation
              .mutateAsync(rel.id)
              .catch(() =>
                showError(
                  "Remove Failed",
                  "Unable to remove this relationship.",
                ),
              ),
        },
      ],
    );
  };

  const handleNavigateToContact = (id: string) => {
    router.push(`/contacts/${id}`);
  };

  return (
    <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.md,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 1,
            color: colors.textSecondary,
          }}
        >
          Relationships
        </Text>
        <Pressable
          onPress={() => setShowAddModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Add relationship"
          style={{
            width: 28,
            height: 28,
            borderRadius: borderRadius.full,
            backgroundColor: colors.primary,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons name="add" size={18} color={colors.card} />
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={colors.primary}
          style={{ marginVertical: spacing.md }}
        />
      ) : relationships.length === 0 ? (
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: borderRadius.lg,
            borderColor: colors.border,
            borderWidth: 1,
            padding: spacing.md,
            alignItems: "center",
            ...shadows.sm,
          }}
        >
          <Text style={{ fontSize: 14, color: colors.textTertiary }}>
            No relationships yet
          </Text>
        </View>
      ) : (
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: borderRadius.lg,
            borderColor: colors.border,
            borderWidth: 1,
            overflow: "hidden",
            ...shadows.sm,
          }}
        >
          {relationships.map((rel, index) => (
            <View
              key={rel.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: spacing.md,
                borderBottomColor: colors.border,
                borderBottomWidth: index < relationships.length - 1 ? 1 : 0,
              }}
            >
              <Pressable
                onPress={() =>
                  rel.relatedContact &&
                  handleNavigateToContact(rel.relatedContact.id)
                }
                style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
              >
                <FaceAvatar
                  name={rel.relatedContact?.name ?? "?"}
                  avatar={rel.relatedContact?.avatarUrl ?? ""}
                  size={36}
                  showLabel={false}
                  noMargin
                />
                <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: colors.textMain,
                    }}
                    numberOfLines={1}
                  >
                    {rel.relatedContact?.name ?? "Unknown"}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.xs,
                      marginTop: 2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.textSecondary,
                      }}
                    >
                      {rel.type}
                    </Text>
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: sentimentColor(rel.sentiment),
                      }}
                    />
                  </View>
                  {rel.description && (
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.textTertiary,
                        marginTop: 2,
                      }}
                      numberOfLines={1}
                    >
                      {rel.description}
                    </Text>
                  )}
                </View>
              </Pressable>
              <Pressable
                onPress={() => handleDelete(rel)}
                accessibilityRole="button"
                accessibilityLabel={`Remove relationship with ${
                  rel.relatedContact?.name ?? "this contact"
                }`}
                hitSlop={8}
                style={{ padding: spacing.xs }}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={20}
                  color={colors.textTertiary}
                />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <AddRelationshipModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        contactId={contactId}
        contactName={contactName}
      />
    </View>
  );
}

// --- Add Relationship Modal ---

function AddRelationshipModal({
  visible,
  onClose,
  contactId,
  contactName,
}: {
  visible: boolean;
  onClose: () => void;
  contactId: string;
  contactName: string;
}) {
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    null,
  );
  const [selectedContactName, setSelectedContactName] = useState("");
  const [type, setType] = useState("");
  const [sentiment, setSentiment] = useState<RelationshipSentiment>(0);
  const [description, setDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: contactsData } = useContactsList({ limit: 50 });
  const createMutation = useCreateRelationship();

  const contacts = (contactsData?.items ?? []).filter(
    (c) => c.id !== contactId,
  );

  const filteredContacts = searchQuery
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.email ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : contacts;

  const handleCreate = async () => {
    if (!selectedContactId || !type.trim()) return;

    try {
      await createMutation.mutateAsync({
        contactId,
        relatedContactId: selectedContactId,
        type: type.trim(),
        sentiment,
        description: description.trim() || undefined,
      });
    } catch {
      // Keep the modal open with the form intact so the user can retry without
      // re-entering everything.
      //
      // Alert rather than a toast: this fires while the add-relationship
      // Modal is open, and a native Modal renders above the toast viewport —
      // the toast would be invisible underneath it.
      Alert.alert(
        "Couldn't Add Relationship",
        "Unable to save this relationship. Please try again.",
      );
      return;
    }

    // Reset state and close
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setSelectedContactId(null);
    setSelectedContactName("");
    setType("");
    setSentiment(0);
    setDescription("");
    setSearchQuery("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: borderRadius.xl,
            borderTopRightRadius: borderRadius.xl,
            maxHeight: "85%",
            paddingBottom: spacing.xl,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: spacing.lg,
              borderBottomColor: colors.border,
              borderBottomWidth: 1,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: colors.textMain,
              }}
            >
              Add Relationship
            </Text>
            <Pressable onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Step 1: Select contact */}
          {!selectedContactId ? (
            <View style={{ padding: spacing.lg }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.textMain,
                  marginBottom: spacing.sm,
                }}
              >
                Who is {contactName} connected to?
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.card,
                  borderRadius: borderRadius.md,
                  borderColor: colors.border,
                  borderWidth: 1,
                  padding: spacing.sm,
                  fontSize: 14,
                  color: colors.textMain,
                  marginBottom: spacing.sm,
                }}
                placeholder="Search contacts..."
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <FlatList
                data={filteredContacts}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 250 }}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      setSelectedContactId(item.id);
                      setSelectedContactName(item.name);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: spacing.sm,
                      borderBottomColor: colors.border,
                      borderBottomWidth: 1,
                    }}
                  >
                    <FaceAvatar
                      name={item.name}
                      avatar={item.avatarUrl ?? ""}
                      size={32}
                      showLabel={false}
                      noMargin
                    />
                    <Text
                      style={{
                        marginLeft: spacing.sm,
                        fontSize: 14,
                        color: colors.textMain,
                      }}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                )}
                ListEmptyComponent={
                  <Text
                    style={{
                      textAlign: "center",
                      color: colors.textTertiary,
                      padding: spacing.lg,
                    }}
                  >
                    No contacts found
                  </Text>
                }
              />
            </View>
          ) : (
            // Scrollable, and a direct child of the 85%-capped sheet so it is
            // actually bounded by it: this step is taller than 85% of a short
            // viewport (landscape, or a large font scale), which left the
            // submit button off-screen with no way to reach it — the same
            // clipping the onboarding carousel had. Only this branch scrolls;
            // step 1's FlatList does its own, and nesting the two breaks both.
            <ScrollView
              contentContainerStyle={{ padding: spacing.lg }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Selected contact pill */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.primaryLight,
                  borderRadius: borderRadius.md,
                  padding: spacing.sm,
                  marginBottom: spacing.md,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontSize: 14,
                    color: colors.primary,
                    fontWeight: "600",
                  }}
                >
                  {contactName} & {selectedContactName}
                </Text>
                <Pressable
                  onPress={() => {
                    setSelectedContactId(null);
                    setSelectedContactName("");
                  }}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={colors.primary}
                  />
                </Pressable>
              </View>

              {/* Relationship type */}
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.textMain,
                  marginBottom: spacing.xs,
                }}
              >
                Relationship Type
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.card,
                  borderRadius: borderRadius.md,
                  borderColor: colors.border,
                  borderWidth: 1,
                  padding: spacing.sm,
                  fontSize: 14,
                  color: colors.textMain,
                  marginBottom: spacing.md,
                }}
                placeholder="e.g. friend, colleague, mentor..."
                placeholderTextColor={colors.textTertiary}
                value={type}
                onChangeText={setType}
              />

              {/* Sentiment */}
              <View style={{ marginBottom: spacing.md }}>
                <ScaleSelector
                  options={SENTIMENT_OPTIONS}
                  value={sentiment}
                  onChange={setSentiment}
                  colorFor={sentimentColor}
                  label="Sentiment"
                />
              </View>

              {/* Description */}
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.textMain,
                  marginBottom: spacing.xs,
                }}
              >
                Description (optional)
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.card,
                  borderRadius: borderRadius.md,
                  borderColor: colors.border,
                  borderWidth: 1,
                  padding: spacing.sm,
                  fontSize: 14,
                  color: colors.textMain,
                  minHeight: 60,
                  textAlignVertical: "top",
                  marginBottom: spacing.lg,
                }}
                placeholder="e.g. Met on a ski trip"
                placeholderTextColor={colors.textTertiary}
                value={description}
                onChangeText={setDescription}
                multiline
              />

              {/* Submit button */}
              <Pressable
                onPress={handleCreate}
                accessibilityRole="button"
                // Distinct from the modal's "Add Relationship" heading, the
                // same way contact-add's submit is "Add Contact to network".
                accessibilityLabel="Add this relationship"
                disabled={!type.trim() || createMutation.isPending}
                style={{
                  backgroundColor:
                    !type.trim() || createMutation.isPending
                      ? colors.textTertiary
                      : colors.primary,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  alignItems: "center",
                }}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.card} />
                ) : (
                  <Text
                    style={{
                      color: colors.card,
                      fontWeight: "700",
                      fontSize: 16,
                    }}
                  >
                    Add Relationship
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
