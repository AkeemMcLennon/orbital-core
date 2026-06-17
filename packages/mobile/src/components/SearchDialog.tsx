import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Adapt, Dialog, Sheet } from "tamagui";
import { router } from "expo-router";
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

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  // Reset the query each time the dialog is opened.
  useEffect(() => {
    if (open) {
      setQuery("");
      setDebounced("");
    }
  }, [open]);

  // Debounce input → debounced query (250ms).
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const configQuery = useSearchConfig();
  const config = configQuery.data ?? null;
  const meiliEnabled = config != null;

  const search = useContactSearch(debounced, config);
  // Fallback when Meilisearch isn't configured: server-side contact search.
  const fallback = useContactSearchFallback(debounced, !meiliEnabled);

  const activeQuery = meiliEnabled ? search : fallback;
  const hasQuery = debounced.trim().length > 0;
  // With keepPreviousData the query retains the last results; ignore them once
  // the field is cleared so we show the prompt, not stale matches.
  const hits = hasQuery ? (activeQuery.data ?? []) : [];
  const isLoading = activeQuery.isFetching && hasQuery;

  const openContact = (id: string) => {
    onOpenChange(false);
    router.push(`/contacts/${id}`);
  };

  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <Adapt platform="touch">
        <Sheet
          modal
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
            <Adapt.Contents />
          </Sheet.Frame>
        </Sheet>
      </Adapt>

      <Dialog.Portal>
        <Dialog.Overlay
          key="overlay"
          animation="quick"
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />
        <Dialog.Content
          key="content"
          backgroundColor="$bg"
          padding={0}
          width="90%"
          maxWidth={520}
          height="80%"
        >
          <SearchContent
            query={query}
            setQuery={setQuery}
            hits={hits}
            isLoading={isLoading}
            hasQuery={hasQuery}
            onClose={() => onOpenChange(false)}
            onSelect={openContact}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

function SearchContent({
  query,
  setQuery,
  hits,
  isLoading,
  hasQuery,
  onClose,
  onSelect,
}: {
  query: string;
  setQuery: (q: string) => void;
  hits: SearchHit[];
  isLoading: boolean;
  hasQuery: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      {/* Search input row */}
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
        <Pressable onPress={onClose} hitSlop={8}>
          <Text
            style={{ fontSize: 15, color: colors.primary, fontWeight: "600" }}
          >
            Cancel
          </Text>
        </Pressable>
      </View>

      {/* Results */}
      {isLoading && hits.length === 0 ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
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
              onPress={() => onSelect(item.id)}
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
            hits.length === 0 ? { flex: 1 } : { paddingVertical: spacing.xs }
          }
          style={{ backgroundColor: colors.bg, borderRadius: borderRadius.sm }}
        />
      )}
    </View>
  );
}
