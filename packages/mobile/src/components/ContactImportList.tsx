import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius } from "../theme";

export type DeviceContact = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  imageUri?: string;
  company?: string;
};

type Props = {
  contacts: DeviceContact[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  isLoading?: boolean;
};

export function ContactImportList({
  contacts,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  isLoading,
}: Props) {
  const [searchText, setSearchText] = useState("");

  const filteredContacts = useMemo(() => {
    if (!searchText.trim()) return contacts;
    const q = searchText.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q),
    );
  }, [contacts, searchText]);

  const allSelected =
    selectedIds.size === contacts.length && contacts.length > 0;

  const renderItem = useCallback(
    ({ item }: { item: DeviceContact }) => {
      const isSelected = selectedIds.has(item.id);
      return (
        <Pressable
          onPress={() => onToggleSelect(item.id)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: spacing.sm + 2,
            paddingHorizontal: spacing.md,
            backgroundColor: isSelected ? colors.primaryLight : "transparent",
          }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: borderRadius.sm,
              borderWidth: 2,
              borderColor: isSelected ? colors.primary : colors.border,
              backgroundColor: isSelected ? colors.primary : "transparent",
              alignItems: "center",
              justifyContent: "center",
              marginRight: spacing.md,
            }}
          >
            {isSelected && (
              <Ionicons name="checkmark" size={16} color={colors.card} />
            )}
          </View>

          {item.imageUri ? (
            <Image
              source={{ uri: item.imageUri }}
              style={{
                width: 40,
                height: 40,
                borderRadius: borderRadius.full,
                marginRight: spacing.md,
              }}
            />
          ) : (
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: borderRadius.full,
                backgroundColor: colors.bgAlt,
                alignItems: "center",
                justifyContent: "center",
                marginRight: spacing.md,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: colors.textSecondary,
                }}
              >
                {item.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </Text>
            </View>
          )}

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
            {(item.email || item.phone) && (
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginTop: 1,
                }}
                numberOfLines={1}
              >
                {item.email || item.phone}
              </Text>
            )}
          </View>
        </Pressable>
      );
    },
    [selectedIds, onToggleSelect],
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text
          style={{
            marginTop: spacing.md,
            color: colors.textSecondary,
            fontSize: 14,
          }}
        >
          Loading contacts...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Search bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.card,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          marginHorizontal: spacing.md,
          marginBottom: spacing.sm,
          borderColor: colors.border,
          borderWidth: 1,
        }}
      >
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          placeholder="Search contacts..."
          placeholderTextColor={colors.textTertiary}
          value={searchText}
          onChangeText={setSearchText}
          style={{
            flex: 1,
            paddingLeft: spacing.sm,
            paddingVertical: spacing.sm + 2,
            color: colors.textMain,
            fontSize: 14,
          }}
        />
        {searchText.length > 0 && (
          <Pressable onPress={() => setSearchText("")}>
            <Ionicons
              name="close-circle"
              size={18}
              color={colors.textTertiary}
            />
          </Pressable>
        )}
      </View>

      {/* Select all / count bar */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
      >
        <Text style={{ fontSize: 13, color: colors.textSecondary }}>
          {selectedIds.size} of {contacts.length} selected
        </Text>
        <Pressable onPress={allSelected ? onDeselectAll : onSelectAll}>
          <Text
            style={{
              fontSize: 13,
              color: colors.primary,
              fontWeight: "600",
            }}
          >
            {allSelected ? "Deselect All" : "Select All"}
          </Text>
        </Pressable>
      </View>

      {/* Contact list */}
      <FlatList
        data={filteredContacts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        initialNumToRender={30}
        maxToRenderPerBatch={30}
        windowSize={10}
        getItemLayout={(_, index) => ({
          length: 56,
          offset: 56 * index,
          index,
        })}
        ItemSeparatorComponent={() => (
          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginLeft: 80,
            }}
          />
        )}
        ListEmptyComponent={
          <View
            style={{
              padding: spacing.xl,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
              {searchText
                ? "No contacts match your search"
                : "No contacts found on this device"}
            </Text>
          </View>
        }
      />
    </View>
  );
}
