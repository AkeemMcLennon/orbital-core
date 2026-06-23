import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Sheet } from "tamagui";
import { Ionicons } from "@expo/vector-icons";

import { ContactRow } from "./ContactRow";
import {
  useContactSearch,
  useContactSearchFallback,
  useSearchConfig,
  type SearchHit,
} from "../queries/search";
import { borderRadius, colors, spacing } from "../theme";

function subtitleFor(c: SearchHit): string | null {
  return c.jobTitle ?? c.company ?? c.email ?? null;
}

export function ContactPickerModal({
  open,
  onClose,
  onSelect,
  title = "Select Contact",
  excludeId,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string, name: string) => void;
  title?: string;
  excludeId?: string;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    if (open) {
      setQuery("");
      setDebounced("");
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const configQuery = useSearchConfig();
  const config = configQuery.data ?? null;
  const meiliEnabled = config != null;

  const search = useContactSearch(debounced, config);
  const fallback = useContactSearchFallback(debounced, !meiliEnabled);

  const activeQuery = meiliEnabled ? search : fallback;
  const hasQuery = debounced.trim().length > 0;
  const allHits = hasQuery ? (activeQuery.data ?? []) : [];
  const hits = excludeId ? allHits.filter((h) => h.id !== excludeId) : allHits;
  const isLoading = activeQuery.isFetching && hasQuery;

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={(o: boolean) => !o && onClose()}
      dismissOnSnapToBottom
      snapPointsMode="percent"
      snapPoints={[84]}
      animation="quick"
    >
      <Sheet.Overlay
        animation="quick"
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
      />
      <Sheet.Handle />
      <Sheet.Frame backgroundColor="$bg" padding={0}>
        {/* Gate inner content on `open`: a bare Sheet keeps its Frame mounted
            even when closed, which would leak the "Cancel" button and search
            input into the tree (and into tests querying the host screen). */}
        {open && (
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: 17,
                  fontWeight: "700",
                  color: colors.textMain,
                  textAlign: "center",
                }}
              >
                {title}
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text
                  style={{
                    fontSize: 15,
                    color: colors.primary,
                    fontWeight: "600",
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
            </View>

            {/* Search input */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                gap: spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <Ionicons name="search" size={18} color={colors.textTertiary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search contacts..."
                placeholderTextColor={colors.textTertiary}
                style={{
                  flex: 1,
                  fontSize: 16,
                  color: colors.textMain,
                  paddingVertical: spacing.xs,
                }}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>

            {/* Results */}
            {isLoading && hits.length === 0 ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <FlatList
                data={hits}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <ContactRow
                    name={item.name}
                    subtitle={subtitleFor(item)}
                    avatar={item.avatarUrl}
                    tags={item.matchedTags}
                    onPress={() => {
                      onSelect(item.id, item.name);
                      onClose();
                    }}
                  />
                )}
                ListEmptyComponent={
                  <View
                    style={{
                      alignItems: "center",
                      paddingTop: spacing.xxl,
                      paddingHorizontal: spacing.lg,
                      gap: spacing.md,
                    }}
                  >
                    <Ionicons
                      name={hasQuery ? "search-outline" : "people-outline"}
                      size={44}
                      color={colors.textTertiary}
                    />
                    <Text
                      style={{
                        fontSize: 15,
                        color: colors.textSecondary,
                        textAlign: "center",
                      }}
                    >
                      {hasQuery
                        ? `No results for "${query.trim()}"`
                        : "Start typing to search your contacts"}
                    </Text>
                  </View>
                }
                contentContainerStyle={
                  hits.length === 0
                    ? { flex: 1 }
                    : { paddingVertical: spacing.xs }
                }
                style={{
                  backgroundColor: colors.bg,
                  borderRadius: borderRadius.sm,
                }}
              />
            )}
          </View>
        )}
      </Sheet.Frame>
    </Sheet>
  );
}
