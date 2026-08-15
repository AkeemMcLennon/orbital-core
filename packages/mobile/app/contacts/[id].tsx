import { useLocalSearchParams } from "expo-router";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ContactDetails } from "../../src/components/ContactDetails";
import { ErrorState } from "../../src/components/ErrorState";
import { useContact } from "../../src/queries/contacts";
import { colors, spacing } from "../../src/theme";

export default function ContactDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: contact, isLoading, error, refetch } = useContact(id);

  if (isLoading && !contact) {
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
          <ErrorState
            error={error}
            noun="contact"
            title="Couldn't load contact"
            onRetry={refetch}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ContactDetails
      id={contact?.id || id || ""}
      role={contact?.jobTitle || ""}
      name={contact?.name || "Unknown"}
      avatar={contact?.avatarUrl || ""}
      strength={contact?.strength ?? 0}
      notes={contact?.notes || ""}
      email={contact?.email || ""}
      phone={contact?.phone || ""}
      // interactions={contact?.interactions || []}
      interactions={[]}
      tags={contact?.tags || []}
      links={contact?.links || []}
    />
  );
}
