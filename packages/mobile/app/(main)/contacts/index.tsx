import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DrawerActions } from "@react-navigation/native";
import { router, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ContactRow } from "../../../src/components/ContactRow";
import { useAllContactsList } from "../../../src/queries/contacts";
import { useAllAvailableContactsList } from "../../../src/queries/available-contacts";
import { colors, spacing, borderRadius } from "../../../src/theme";

type Section<T> = { title: string; data: T[] };

function groupByLetter<T extends { name: string }>(items: T[]): Section<T>[] {
  const sorted = [...items].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  const map = new Map<string, T[]>();
  for (const item of sorted) {
    const letter = item.name[0]?.toUpperCase() ?? "#";
    const key = /[A-Z]/.test(letter) ? letter : "#";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

const ALPHABET = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type ActiveContact = {
  id: string;
  name: string;
  email?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  avatarUrl?: string | null;
};
type DirectoryContact = {
  id: string;
  name: string;
  email?: string | null;
  company?: string | null;
};

function SectionHeader({ title }: { title: string }) {
  return (
    <View
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        backgroundColor: colors.bgAlt,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: "700",
          color: colors.textSecondary,
          letterSpacing: 0.5,
        }}
      >
        {title}
      </Text>
    </View>
  );
}

function AlphabetSidebar({
  sections,
  onPress,
}: {
  sections: Section<any>[];
  onPress: (index: number) => void;
}) {
  const letters = sections.map((s) => s.title);
  return (
    <View
      style={{
        position: "absolute",
        right: 2,
        top: 0,
        bottom: 0,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
      }}
    >
      {ALPHABET.filter((l) => letters.includes(l)).map((letter) => {
        const idx = sections.findIndex((s) => s.title === letter);
        return (
          <Pressable
            key={letter}
            onPress={() => idx >= 0 && onPress(idx)}
            style={{ paddingVertical: 1, paddingHorizontal: 4 }}
            hitSlop={4}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "600",
                color: colors.primary,
              }}
            >
              {letter}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ContactList<
  T extends { id: string; name: string; avatarUrl?: string | null },
>({
  items,
  isLoading,
  subtitle,
  query,
  showSidebar,
  onPress,
}: {
  items: T[];
  isLoading: boolean;
  subtitle: (item: T) => string | null | undefined;
  query: string;
  showSidebar: boolean;
  onPress?: (id: string) => void;
}) {
  const listRef = useRef<SectionList>(null);
  const sections = groupByLetter(items);

  const scrollToSection = (index: number) => {
    listRef.current?.scrollToLocation({
      sectionIndex: index,
      itemIndex: 0,
      animated: true,
    });
  };

  if (isLoading && items.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isLoading && items.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
        <Text
          style={{
            marginTop: spacing.md,
            fontSize: 15,
            color: colors.textSecondary,
          }}
        >
          {query ? `No results for "${query}"` : "No contacts yet"}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        ref={listRef}
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContactRow
            name={item.name}
            subtitle={subtitle(item)}
            avatar={item.avatarUrl}
            onPress={onPress ? () => onPress(item.id) : undefined}
          />
        )}
        renderSectionHeader={({ section }) => (
          <SectionHeader title={section.title} />
        )}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingRight: showSidebar ? 20 : 0 }}
        onScrollToIndexFailed={() => {}}
      />
      {showSidebar && (
        <AlphabetSidebar sections={sections} onPress={scrollToSection} />
      )}
    </View>
  );
}

type Tab = "active" | "directory";

function filterContacts<
  T extends {
    name: string;
    email?: string | null;
    company?: string | null;
    jobTitle?: string | null;
  },
>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.jobTitle?.toLowerCase().includes(q),
  );
}

export default function ContactsScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<Tab>("active");
  const [query, setQuery] = useState("");

  const activeContacts = useAllContactsList();
  const directoryContacts = useAllAvailableContactsList();

  const filteredActive = filterContacts(activeContacts.data ?? [], query);
  const filteredDirectory = filterContacts(directoryContacts.data ?? [], query);
  const showSidebar = query.trim().length === 0;

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
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          style={{ marginRight: spacing.md }}
          hitSlop={8}
        >
          <Ionicons name="menu" size={24} color={colors.textMain} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            fontSize: 18,
            fontWeight: "700",
            color: colors.textMain,
          }}
        >
          Contacts
        </Text>
        {(activeContacts.isFetchingNextPage ||
          directoryContacts.isFetchingNextPage) && (
          <ActivityIndicator size="small" color={colors.primary} />
        )}
      </View>

      {/* Search bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          gap: spacing.sm,
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
            fontSize: 15,
            color: colors.textMain,
            paddingVertical: spacing.xs,
          }}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="never"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")} hitSlop={8}>
            <Ionicons
              name="close-circle"
              size={18}
              color={colors.textTertiary}
            />
          </Pressable>
        )}
      </View>

      {/* Tab switcher */}
      <View
        style={{
          flexDirection: "row",
          padding: spacing.sm,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          gap: spacing.sm,
        }}
      >
        {(["active", "directory"] as Tab[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            accessibilityRole="tab"
            accessibilityLabel={
              tab === "active" ? "Active contacts" : "Directory contacts"
            }
            // Which tab is current is otherwise conveyed by background colour
            // alone — invisible to a screen reader.
            accessibilityState={{ selected: activeTab === tab }}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              borderRadius: borderRadius.full,
              backgroundColor:
                activeTab === tab ? colors.primary : colors.bgAlt,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: activeTab === tab ? "#fff" : colors.textSecondary,
              }}
            >
              {tab === "active" ? "Active" : "Directory"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* List */}
      {activeTab === "active" ? (
        <ContactList
          items={filteredActive}
          isLoading={activeContacts.isLoading}
          subtitle={(c: ActiveContact) =>
            c.jobTitle ?? c.company ?? c.email ?? null
          }
          query={query}
          showSidebar={showSidebar}
          onPress={(id) => router.push(`/contacts/${id}`)}
        />
      ) : (
        <ContactList
          items={filteredDirectory}
          isLoading={directoryContacts.isLoading}
          subtitle={(c: DirectoryContact) => c.company ?? c.email ?? null}
          query={query}
          showSidebar={showSidebar}
        />
      )}
    </SafeAreaView>
  );
}
