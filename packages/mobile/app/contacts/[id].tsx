import React, { useMemo } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getContacts } from "@orbital/client";
import { ContactDetails } from "../../src/components/ContactDetails";
import { colors, spacing } from "../../src/theme";

export default function ContactDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  // First, try to get from existing contacts cache
  const cachedContacts = queryClient.getQueryData(["contacts"]) as any;
  const cachedContact = useMemo(() => {
    if (cachedContacts?.data?.items) {
      return cachedContacts.data.items.find(
        (c: any) => c.id === id
      );
    }
    return null;
  }, [cachedContacts, id]);

  // Only fetch if not in cache
  const {
    data: fetchedContact,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["contact", id],
    queryFn: () => getContacts({ limit: 1, offset: 0, sort: "date" }),
    enabled: !cachedContact, // Only fetch if not in cache
    throwOnError: false,
    select: (data) => {
      // Return the first matching contact from the search
      if (data?.status === 200 && data.data.items.length > 0) {
        return data.data.items[0];
      }
      return null;
    },
  });

  // Use cached contact if available, otherwise use fetched
  const contact = cachedContact || fetchedContact;

  if (isLoading && !cachedContact) {
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

  if (error || (!contact && !isLoading)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: spacing.lg,
          }}
        >
          <Text
            style={{
              color: colors.error,
              fontSize: 16,
              textAlign: "center",
            }}
          >
            Failed to load contact details. Please try again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ContactDetails
      id={contact?.id || id || ""}
      name={contact?.name || "Unknown"}
      role={contact?.role || "Contact"}
      avatar={contact?.avatarUrl || ""}
      notes={contact?.notes}
      email={contact?.email}
      phone={contact?.phone}
      interactions={contact?.interactions || []}
    />
  );
}
