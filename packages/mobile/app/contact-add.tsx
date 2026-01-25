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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContact } from "@orbital/client";
import { colors, spacing, borderRadius, shadows } from "../src/theme";
import { searchResults } from "../src/dummy-data";

export default function AddContactScreen() {
  const [isAiMode, setIsAiMode] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedContact, setSelectedContact] = useState<
    (typeof searchResults)[0] | null
  >(null);
  const [showResults, setShowResults] = useState(false);
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  // Mutation for creating contact
  const createContactMutation = useMutation({
    mutationFn: (data: { name: string; email?: string; notes?: string }) =>
      createContact(data),
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

  const handleContactSelect = (contact: (typeof searchResults)[0]) => {
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
      email: selectedContact?.email,
      notes: notes || undefined,
    });
  };

  const filteredResults = searchResults.filter((contact) =>
    contact.name.toLowerCase().includes(searchText.toLowerCase()),
  );

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
                setShowResults(text.length > 0);
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
          {showResults && filteredResults.length > 0 && !selectedContact && (
            <View
              style={{
                marginTop: spacing.md,
                backgroundColor: colors.card,
                borderRadius: borderRadius.md,
                overflow: "hidden",
                borderColor: colors.border,
                borderWidth: 1,
                ...shadows.md,
              }}
            >
              {filteredResults.map((contact, index) => (
                <Pressable
                  key={contact.id}
                  onPress={() => handleContactSelect(contact)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: spacing.md,
                    borderBottomWidth:
                      index < filteredResults.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Image
                    source={{ uri: contact.avatar }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: borderRadius.full,
                      marginRight: spacing.md,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 14,
                      color: colors.textMain,
                      fontWeight: "500",
                    }}
                  >
                    {contact.name}
                  </Text>
                </Pressable>
              ))}
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
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Image
                source={{ uri: selectedContact.avatar }}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: borderRadius.full,
                  marginRight: spacing.md,
                }}
              />
              <Text
                style={{ fontSize: 16, color: colors.card, fontWeight: "600" }}
              >
                {selectedContact.name}
              </Text>
            </View>
            <Pressable onPress={() => setSelectedContact(null)}>
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
