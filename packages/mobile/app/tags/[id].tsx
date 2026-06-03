import React from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { FaceAvatar } from "../../src/components/FaceAvatar";
import { useContactsByTag } from "../../src/queries/contacts";
import { colors, spacing } from "../../src/theme";

export default function ContactsByTagScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { data: contacts, isLoading } = useContactsByTag(id);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ marginRight: spacing.md }}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textMain} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            fontSize: 18,
            fontWeight: "700",
            color: colors.textMain,
          }}
        >
          {name ?? "Tag"}
        </Text>
      </View>

      {isLoading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !contacts || contacts.length === 0 ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: spacing.lg,
          }}
        >
          <Ionicons
            name="people-outline"
            size={48}
            color={colors.textTertiary}
          />
          <Text
            style={{
              marginTop: spacing.md,
              fontSize: 15,
              color: colors.textSecondary,
              textAlign: "center",
            }}
          >
            No contacts tagged with this
          </Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const subtitle =
              item.jobTitle ?? item.company ?? item.email ?? null;
            return (
              <Pressable
                onPress={() => router.push(`/contacts/${item.id}` as any)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  backgroundColor: colors.card,
                  gap: spacing.md,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <FaceAvatar
                  name={item.name}
                  size={40}
                  showLabel={false}
                  noMargin
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "500",
                      color: colors.textMain,
                    }}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {!!subtitle && (
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.textTertiary,
                        marginTop: 1,
                      }}
                      numberOfLines={1}
                    >
                      {subtitle}
                    </Text>
                  )}
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textTertiary}
                />
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
