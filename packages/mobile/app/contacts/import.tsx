import React, { useState, useCallback, useEffect } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Contacts from "expo-contacts";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bulkCreateContacts, integrationsGoogleConnect } from "@orbital/client";
import { useVCardQuery } from "../../src/hooks/useVCardQuery";
import { uploadAvatar } from "../../src/lib/uploadAvatar";
import { colors, spacing, borderRadius, typography } from "../../src/theme";
import {
  ContactImportList,
  type SelectableContact,
} from "../../src/components/ContactImportList";
import { SourceCard } from "../../src/components/SourceCard";

type Screen = "sources" | "select-device";

const CONTACT_FIELDS = [
  Contacts.Fields.PhoneNumbers,
  Contacts.Fields.Emails,
  Contacts.Fields.Image,
  Contacts.Fields.Company,
];

async function fetchDeviceContacts(): Promise<SelectableContact[]> {
  const { data } = await Contacts.getContactsAsync({ fields: CONTACT_FIELDS });
  return data
    .filter((c) => c.name)
    .map((c) => {
      const imageUri = c.image?.uri;
      return {
        name: c.name!,
        email: c.emails?.[0]?.email,
        phone: c.phoneNumbers?.[0]?.number,
        company: c.company ?? undefined,
        avatar: imageUri
          ? imageUri.startsWith("http")
            ? { kind: "remote" as const, url: imageUri }
            : { kind: "local" as const, uri: imageUri, mimeType: "image/jpeg" }
          : undefined,
        id: c.id!,
      };
    });
}

export default function ImportContactsScreen() {
  const { vcfUri } = useLocalSearchParams<{ vcfUri?: string }>();
  const [screen, setScreen] = useState<Screen>(
    vcfUri ? "select-device" : "sources",
  );
  const [deviceContacts, setDeviceContacts] = useState<SelectableContact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (contacts: SelectableContact[]) => {
      const created: { id: string }[] = [];
      for (let i = 0; i < contacts.length; i += 500) {
        const slice = contacts.slice(i, i + 500);
        const response = await bulkCreateContacts({
          contacts: slice.map((c) => ({
            name: c.name,
            email: c.email,
            phone: c.phone,
            company: c.company,
            jobTitle: c.jobTitle,
            birthday: c.birthday,
            avatarUrl: c.avatar?.kind === "remote" ? c.avatar.url : undefined,
          })),
        });
        if (response.status !== 200) continue;
        created.push(...response.data);
        // Remote avatars go through the bulk payload; local URIs (device
        // content:// or vCard file://) are uploaded per-contact afterwards.
        // bulkCreateContacts returns rows in input order, so pair by index.
        await Promise.all(
          response.data.map(async (row, j) => {
            const avatar = slice[j]?.avatar;
            if (avatar?.kind !== "local") return;
            try {
              await uploadAvatar(row.id, avatar.uri, avatar.mimeType);
            } catch (err) {
              console.error("Avatar upload failed:", err);
            }
          }),
        );
      }
      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      if (created.length === 1) {
        router.replace(`/contacts/${created[0].id}`);
      } else {
        router.replace("/(main)/contacts");
      }
    },
    onError: (error) => {
      console.error("Import failed:", error);
      Alert.alert("Import Failed", "Something went wrong. Please try again.");
    },
  });

  // When launched from a shared .vcf file, map the parsed + avatar-materialized
  // cards (from the hook) into the selectable list once they're available.
  const { data: vcards, isLoading: isLoadingVCards } = useVCardQuery(vcfUri);

  useEffect(() => {
    if (!vcards) return;
    // Single card: hand off to the add-contact screen for richer field prefill.
    if (vcards.length === 1) {
      router.replace({ pathname: "/contact-add", params: { vcfUri } });
      return;
    }
    const list: SelectableContact[] = vcards.map(({ card, avatar }, i) => ({
      name: card.name,
      email: card.email,
      phone: card.phone,
      company: card.company,
      jobTitle: card.jobTitle,
      birthday: card.birthday,
      notes: card.notes,
      rawLinks: card.urls,
      avatar: avatar
        ? avatar.uri.startsWith("http")
          ? { kind: "remote" as const, url: avatar.uri }
          : {
              kind: "local" as const,
              uri: avatar.uri,
              mimeType: avatar.mimeType,
            }
        : undefined,
      id: `vcf-${i}`,
    }));
    setScreen("select-device");
    setDeviceContacts(list);
    setSelectedIds(new Set(list.map((c) => c.id)));
  }, [vcards, vcfUri]);

  const requestContactsPermission = async (): Promise<boolean> => {
    const { status } = await Contacts.getPermissionsAsync();
    if (status === "granted") return true;
    const { status: newStatus } = await Contacts.requestPermissionsAsync();
    return newStatus === "granted";
  };

  const loadDeviceContacts = useCallback(async () => {
    setIsLoadingContacts(true);
    try {
      const granted = await requestContactsPermission();
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "Please allow access to your contacts in Settings.",
        );
        setIsLoadingContacts(false);
        return;
      }

      const mapped = (await fetchDeviceContacts()).sort((a, b) =>
        a.name.localeCompare(b.name),
      );

      setDeviceContacts(mapped);
    } catch (error) {
      console.error("Failed to load contacts:", error);
      Alert.alert("Error", "Failed to load device contacts.");
    } finally {
      setIsLoadingContacts(false);
    }
  }, []);

  const handleSyncAll = useCallback(async () => {
    const granted = await requestContactsPermission();
    if (!granted) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your contacts in Settings.",
      );
      return;
    }

    setIsLoadingContacts(true);
    try {
      const contacts = await fetchDeviceContacts();
      if (contacts.length === 0) {
        Alert.alert("No Contacts", "No contacts found on this device.");
        return;
      }
      importMutation.mutate(contacts);
    } catch (error) {
      console.error("Sync failed:", error);
      Alert.alert("Sync Failed", "Something went wrong. Please try again.");
    } finally {
      setIsLoadingContacts(false);
    }
  }, [importMutation]);

  const handleSelectDeviceContacts = useCallback(async () => {
    setScreen("select-device");
    await loadDeviceContacts();
  }, [loadDeviceContacts]);

  const handleImportSelected = useCallback(() => {
    const selected = deviceContacts.filter((c) => selectedIds.has(c.id));
    if (selected.length === 0) {
      Alert.alert("No Selection", "Please select at least one contact.");
      return;
    }
    importMutation.mutate(selected);
  }, [deviceContacts, selectedIds, importMutation]);

  const handleGoogleConnect = useCallback(async () => {
    try {
      const redirectUrl = Linking.createURL("google-connected");
      const response = await integrationsGoogleConnect({ next: redirectUrl });
      if (response.status === 200 && response.data) {
        const data = response.data as { url: string; state: string };
        await WebBrowser.openAuthSessionAsync(data.url);
        queryClient.invalidateQueries({ queryKey: ["available-contacts"] });
        Alert.alert(
          "Google Connected",
          "Your Google contacts will be synced shortly.",
        );
      } else {
        Alert.alert("Error", "Failed to start Google connection.");
      }
    } catch (error) {
      console.error("Google connect failed:", error);
      Alert.alert("Error", "Failed to connect to Google.");
    }
  }, [queryClient]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(deviceContacts.map((c) => c.id)));
  }, [deviceContacts]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Source selection screen
  if (screen === "sources") {
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
            style={{
              fontSize: typography.lg,
              fontWeight: "700",
              color: colors.textMain,
            }}
          >
            Import Contacts
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={{ padding: spacing.lg }}>
          <Text
            style={{
              fontSize: typography.sm,
              color: colors.textSecondary,
              marginBottom: spacing.lg,
            }}
          >
            Import contacts from your phone or connected accounts to build your
            network.
          </Text>

          {/* Sync Device Contacts */}
          <SourceCard
            icon="phone-portrait-outline"
            title="Sync Device Contacts"
            description="Import all contacts from this device at once."
            onPress={handleSyncAll}
            isLoading={isLoadingContacts}
          />

          {/* Select Device Contacts */}
          <SourceCard
            icon="people-outline"
            title="Select Device Contacts"
            description="Choose specific people to import from your phone."
            onPress={handleSelectDeviceContacts}
          />

          {/*
            Google Contacts. This card opens a real Google OAuth consent screen, so it falls
            under Google's branding guidelines: the "G" must be the unmodified full-color
            artwork on a white background. See assets/images/README.md.
          */}
          <SourceCard
            logo={require("../../assets/images/google-g-logo.png")}
            logoAspectRatio={200 / 204}
            title="Google Contacts"
            description="Connect your Google account to sync contacts."
            onPress={handleGoogleConnect}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Device contact selection screen
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
        <Pressable onPress={() => setScreen("sources")}>
          <Ionicons name="chevron-back" size={24} color={colors.textMain} />
        </Pressable>
        <Text
          style={{
            fontSize: typography.lg,
            fontWeight: "700",
            color: colors.textMain,
          }}
        >
          Select Contacts
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Contact list */}
      <ContactImportList
        contacts={deviceContacts}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        isLoading={isLoadingContacts || isLoadingVCards}
      />

      {/* Import button */}
      {selectedIds.size > 0 && (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <Pressable
            onPress={handleImportSelected}
            disabled={importMutation.isPending}
            style={{
              backgroundColor: colors.primary,
              borderRadius: borderRadius.lg,
              paddingVertical: spacing.md,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              opacity: importMutation.isPending ? 0.7 : 1,
            }}
          >
            {importMutation.isPending ? (
              <ActivityIndicator
                size="small"
                color={colors.card}
                style={{ marginRight: spacing.sm }}
              />
            ) : null}
            <Text
              style={{
                color: colors.card,
                fontWeight: "600",
                fontSize: typography.base,
              }}
            >
              {importMutation.isPending
                ? "Importing..."
                : `Import ${selectedIds.size} Contact${selectedIds.size !== 1 ? "s" : ""}`}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
