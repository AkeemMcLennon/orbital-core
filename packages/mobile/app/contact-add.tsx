import React, { useState } from "react";
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
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounceValue } from "usehooks-ts";
import {
  createContact,
  searchAvailableContacts,
  getAvailableContacts,
} from "@orbital/client";
import { colors, spacing, borderRadius, shadows } from "../src/theme";

export default function AddContactScreen() {
  const [isAiMode, setIsAiMode] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText] = useDebounceValue(searchText, 300);
  
  // We'll trust the API return type, but define a partial shape for local state
  // to avoid complex generic imports.
  const [selectedContact, setSelectedContact] = useState<{
    id: string;
    name: string;
    email?: string | null;
    avatarUrl?: string | null;
  } | null>(null);
  
  const [showResults, setShowResults] = useState(false);
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  // Query for searching/listing available contacts
  const { data: searchData, isLoading: isSearching } = useQuery({
    queryKey: ["available-contacts", debouncedSearchText],
    queryFn: async () => {
      if (!debouncedSearchText.trim()) {
        // If no search text, fetch recent/default available contacts
        return getAvailableContacts({ limit: 10, offset: 0 });
      }
      return searchAvailableContacts({
        query: debouncedSearchText,
        limit: 10,
        offset: 0,
      });
    },
    // Keep previous data while searching to avoid flicker
    placeholderData: (previousData) => previousData,
  });
  const availableContacts =
    searchData?.status === 200 ? searchData.data.items : [];

  // Mutation for creating contact
  const createContactMutation = useMutation({
    mutationFn: (data: {
      name: string;
      email?: string;
      notes?: string;
      avatarUrl?: string;
    }) => createContact(data),
    onSuccess: () => {
      // Invalidate and refetch contacts query
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      router.back();
    },
    onError: (error) => {
      console.error("Failed to create contact:", error);
      alert("Failed to create contact. Please try again.");
    },
  });

  const handleContactSelect = (contact: (typeof availableContacts)[0]) => {
    setSelectedContact(contact);
    setSearchText(contact.name);
    setShowResults(false);
  };

  const handleAddContact = async () => {
    const name = selectedContact?.name || searchText.trim();
    if (!name) {
      alert("Please enter a contact name");
      return;
    }

    createContactMutation.mutate({
      name,
      email: selectedContact?.email || undefined,
      avatarUrl: selectedContact?.avatarUrl || undefined,
      notes: notes || undefined,
    });
  };

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
          Add Contact
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.lg,
        }}
      >
        {/* Import from device button */}
        <Pressable
          onPress={() => router.push("/contacts/import")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.primaryLight,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            marginBottom: spacing.lg,
          }}
        >
          <Ionicons
            name="download-outline"
            size={20}
            color={colors.primary}
            style={{ marginRight: spacing.sm }}
          />
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.primary,
              flex: 1,
            }}
          >
            Import from Phone or Google
          </Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.primary}
          />
        </Pressable>
        {/* Hybrid Search Input */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMain,
              marginBottom: spacing.sm,
            }}
          >
            Name
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.card,
              borderRadius: borderRadius.md,
              paddingHorizontal: spacing.md,
              borderColor: isAiMode ? colors.primary : colors.border,
              borderWidth: 2,
              ...shadows.sm,
            }}
          >
            <Ionicons
              name={isAiMode ? "sparkles" : "search"}
              size={18}
              color={isAiMode ? colors.primary : colors.textTertiary}
            />
            <TextInput
              placeholder={
                isAiMode ? "Ask AI to find..." : "Search contacts..."
              }
              placeholderTextColor={colors.textTertiary}
              value={searchText}
              onChangeText={(text) => {
                setSearchText(text);
                setShowResults(true);
                // Clear selection if user types
                if (selectedContact && text !== selectedContact.name) {
                  setSelectedContact(null);
                }
              }}
              style={{
                flex: 1,
                paddingLeft: spacing.sm,
                paddingVertical: spacing.md,
                color: colors.textMain,
                fontSize: 14,
              }}
            />
            <Pressable
              onPress={() => setIsAiMode(!isAiMode)}
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: borderRadius.full,
                backgroundColor: isAiMode ? colors.primary : colors.bg,
              }}
            >
              <Text
                style={{
                  color: isAiMode ? colors.card : colors.textTertiary,
                  fontSize: 11,
                  fontWeight: "600",
                }}
              >
                {isAiMode ? "AI" : "Local"}
              </Text>
            </Pressable>
          </View>

          {/* Search Results */}
          {showResults && !selectedContact && (
            <View
              style={{
                marginTop: spacing.md,
                backgroundColor: colors.card,
                borderRadius: borderRadius.md,
                overflow: "hidden",
                borderColor: colors.border,
                borderWidth: 1,
                ...shadows.md,
                maxHeight: 250, // Limit height
              }}
            >
              {isSearching ? (
                <View style={{ padding: spacing.md, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : availableContacts.length > 0 ? (
                availableContacts.map((contact, index) => (
                  <Pressable
                    key={contact.id}
                    onPress={() => handleContactSelect(contact)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: spacing.md,
                      borderBottomWidth:
                        index < availableContacts.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Image
                      source={{
                        uri:
                          contact.avatarUrl ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            contact.name,
                          )}&background=random`,
                      }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: borderRadius.full,
                        marginRight: spacing.md,
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          color: colors.textMain,
                          fontWeight: "500",
                        }}
                      >
                        {contact.name}
                      </Text>
                      {contact.email && (
                        <Text
                          style={{
                            fontSize: 12,
                            color: colors.textSecondary,
                          }}
                          numberOfLines={1}
                        >
                          {contact.email}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                ))
              ) : (
                <View style={{ padding: spacing.md }}>
                  <Text
                    style={{ color: colors.textTertiary, textAlign: "center" }}
                  >
                    No contacts found
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Selected Contact Card */}
        {selectedContact && (
          <View
            style={{
              backgroundColor: colors.primary,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              marginBottom: spacing.lg,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              ...shadows.md,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
            >
              <Image
                source={{
                  uri:
                    selectedContact.avatarUrl ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      selectedContact.name,
                    )}&background=random`,
                }}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: borderRadius.full,
                  marginRight: spacing.md,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 16,
                    color: colors.card,
                    fontWeight: "600",
                  }}
                >
                  {selectedContact.name}
                </Text>
                {selectedContact.email && (
                  <Text
                    style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}
                    numberOfLines={1}
                  >
                    {selectedContact.email}
                  </Text>
                )}
              </View>
            </View>
            <Pressable
              onPress={() => {
                setSelectedContact(null);
                setSearchText("");
              }}
            >
              <Ionicons name="close" size={20} color={colors.card} />
            </Pressable>
          </View>
        )}

        {/* Notes Field */}
        <View>
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
          disabled={createContactMutation.isPending}
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.border,
            opacity: createContactMutation.isPending ? 0.5 : 1,
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
          onPress={handleAddContact}
          disabled={
            (!selectedContact && !searchText.trim()) ||
            createContactMutation.isPending
          }
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.lg,
            backgroundColor:
              selectedContact || searchText.trim()
                ? colors.primary
                : colors.border,
            opacity: !selectedContact && !searchText.trim() ? 0.5 : 1,
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "row",
          }}
        >
          {createContactMutation.isPending ? (
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
            {createContactMutation.isPending ? "Adding..." : "Add Contact"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
