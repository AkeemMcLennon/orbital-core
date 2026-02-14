import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Contacts from "expo-contacts";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { importContacts, integrationsGoogleConnect } from "@orbital/client";
import {
  colors,
  spacing,
  borderRadius,
  shadows,
  typography,
} from "../../src/theme";
import {
  ContactImportList,
  type DeviceContact,
} from "../../src/components/ContactImportList";

type Screen = "sources" | "select-device";

export default function ImportContactsScreen() {
  const [screen, setScreen] = useState<Screen>("sources");
  const [deviceContacts, setDeviceContacts] = useState<DeviceContact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: (contacts: DeviceContact[]) =>
      importContacts({
        source: "device",
        contacts: contacts.map((c) => ({
          externalId: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          avatarUrl: c.imageUri,
          company: c.company,
        })),
      }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["available-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      const count = response.status === 200 ? response.data.imported : 0;
      Alert.alert(
        "Import Complete",
        `${count} contact${count !== 1 ? "s" : ""} imported successfully.`,
        [{ text: "OK", onPress: () => router.back() }],
      );
    },
    onError: (error) => {
      console.error("Import failed:", error);
      Alert.alert("Import Failed", "Something went wrong. Please try again.");
    },
  });

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

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
          Contacts.Fields.Image,
          Contacts.Fields.Company,
        ],
      });

      const mapped: DeviceContact[] = data
        .filter((c) => c.name) // Skip contacts without names
        .map((c) => ({
          id: c.id!,
          name: c.name!,
          email: c.emails?.[0]?.email,
          phone: c.phoneNumbers?.[0]?.number,
          imageUri: c.image?.uri,
          company: c.company ?? undefined,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

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
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
          Contacts.Fields.Image,
          Contacts.Fields.Company,
        ],
      });

      const mapped: DeviceContact[] = data
        .filter((c) => c.name)
        .map((c) => ({
          id: c.id!,
          name: c.name!,
          email: c.emails?.[0]?.email,
          phone: c.phoneNumbers?.[0]?.number,
          imageUri: c.image?.uri,
          company: c.company ?? undefined,
        }));

      if (mapped.length === 0) {
        Alert.alert("No Contacts", "No contacts found on this device.");
        return;
      }

      // Import in chunks of 500 (API max)
      const chunks: DeviceContact[][] = [];
      for (let i = 0; i < mapped.length; i += 500) {
        chunks.push(mapped.slice(i, i + 500));
      }

      let totalImported = 0;
      for (const chunk of chunks) {
        const response = await importContacts({
          source: "device",
          contacts: chunk.map((c) => ({
            externalId: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            avatarUrl: c.imageUri,
            company: c.company,
          })),
        });
        if (response.status === 200) {
          totalImported += response.data.imported;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["available-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      Alert.alert(
        "Sync Complete",
        `${totalImported} contact${totalImported !== 1 ? "s" : ""} imported from your device.`,
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (error) {
      console.error("Sync failed:", error);
      Alert.alert("Sync Failed", "Something went wrong. Please try again.");
    } finally {
      setIsLoadingContacts(false);
    }
  }, [queryClient]);

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
      debugger;
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

          {/* Google Contacts */}
          <SourceCard
            icon="logo-google"
            title="Google Contacts"
            description="Connect your Google account to sync contacts."
            onPress={handleGoogleConnect}
            iconColor="#4285F4"
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
        isLoading={isLoadingContacts}
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

function SourceCard({
  icon,
  title,
  description,
  onPress,
  isLoading,
  iconColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  isLoading?: boolean;
  iconColor?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={isLoading}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.sm,
        opacity: isLoading ? 0.7 : 1,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: borderRadius.md,
          backgroundColor: colors.primaryLight,
          alignItems: "center",
          justifyContent: "center",
          marginRight: spacing.md,
        }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name={icon} size={22} color={iconColor ?? colors.primary} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: typography.base,
            fontWeight: "600",
            color: colors.textMain,
            marginBottom: 2,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: typography.xs,
            color: colors.textSecondary,
            lineHeight: 16,
          }}
        >
          {description}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
    </Pressable>
  );
}
