import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounceValue } from "usehooks-ts";
import * as ImagePicker from "expo-image-picker";
import {
  searchAvailableContacts,
  getAvailableContacts,
  contactsExtractFromImage,
  isSuccess,
} from "@orbital/client";
import { useExtractImageQuery } from "../src/hooks/useExtractImageQuery";
import { contactKeys } from "../src/queries/contacts";
import { createContactWithAvatar } from "../src/lib/createContactWithAvatar";
import Constants from "expo-constants";
import { colors, spacing, borderRadius, shadows } from "../src/theme";
import {
  fetchMetadata,
  isUrl,
  type MetadataResult,
} from "../src/utils/metadata";
import { WebCaptureModal } from "../src/components/WebCaptureModal";

export default function AddContactScreen() {
  const {
    url: deepLinkUrl,
    sharedImageUri,
    sharedImageMimeType,
    croppedImageUri,
  } = useLocalSearchParams<{
    url?: string;
    sharedImageUri?: string;
    sharedImageMimeType?: string;
    croppedImageUri?: string;
  }>();
  const [isAiMode, setIsAiMode] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText] = useDebounceValue(searchText, 300);
  const [urlMetadata, setUrlMetadata] = useState<MetadataResult | null>(null);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);

  // We'll trust the API return type, but define a partial shape for local state
  // to avoid complex generic imports.
  const [selectedContact, setSelectedContact] = useState<{
    id: string;
    name: string;
    email?: string | null;
    avatarUrl?: string | null;
  } | null>(null);

  const [showResults, setShowResults] = useState(false);
  const [notes, setNotes] = useState("");
  const [isExtractingImage, setIsExtractingImage] = useState(false);
  const [avatarMimeType, setAvatarMimeType] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWebCapture, setShowWebCapture] = useState(false);
  const [webCaptureUrl, setWebCaptureUrl] = useState("");
  const queryClient = useQueryClient();
  const extractionApplied = useRef(false);

  // If arriving from contact-screenshot-crop, extraction may already be cached
  const {
    data: extractedData,
    isLoading: isLoadingExtraction,
    isError: isExtractionError,
  } = useExtractImageQuery(sharedImageUri, sharedImageMimeType);

  function applyExtractedContact(
    data: {
      name?: string;
      email?: string | null;
      phone?: string;
      company?: string;
      jobTitle?: string;
      linkedinUrl?: string;
    },
    avatarUri?: string,
    mimeType?: string,
  ) {
    const name = data.name || "Unknown";
    setSearchText(name);
    setSelectedContact({
      id: `extracted:${Date.now()}`,
      name,
      email: data.email ?? null,
      avatarUrl: avatarUri ?? null,
    });
    setAvatarMimeType(
      avatarUri && !avatarUri.startsWith("http")
        ? (mimeType ?? "image/jpeg")
        : null,
    );
    setShowResults(false);
    const extra = [
      data.phone && `Phone: ${data.phone}`,
      data.company && `Company: ${data.company}`,
      data.jobTitle && `Title: ${data.jobTitle}`,
      data.linkedinUrl && `LinkedIn: ${data.linkedinUrl}`,
    ]
      .filter(Boolean)
      .join("\n");
    if (extra) setNotes(extra);
  }

  // Pre-fill from deep link url param on mount
  useEffect(() => {
    if (deepLinkUrl) {
      setSearchText(deepLinkUrl);
      triggerMetadataFetch(deepLinkUrl, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Populate form when shared-image extraction completes (may be instant from cache)
  useEffect(() => {
    if (isExtractionError) {
      if (extractionApplied.current) return;
      extractionApplied.current = true;
      Alert.alert(
        "Extraction failed",
        "Unable to read contact info from this image.",
      );
      return;
    }
    if (!extractedData || extractionApplied.current) return;
    extractionApplied.current = true;
    applyExtractedContact(extractedData, croppedImageUri);
  }, [extractedData, isExtractionError]);

  // Auto-fetch metadata when search text looks like a URL
  useEffect(() => {
    if (isUrl(debouncedSearchText) && !selectedContact) {
      triggerMetadataFetch(debouncedSearchText);
    } else if (!isUrl(debouncedSearchText)) {
      setUrlMetadata(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchText]);

  function selectFromMetadata(metadata: MetadataResult) {
    const name = metadata.title || metadata.url;
    setSearchText(name);
    setSelectedContact({
      id: metadata.url,
      name,
      email: undefined,
      avatarUrl: metadata.image || undefined,
    });
    setNotes(metadata.description || "");
    setShowResults(false);
  }

  async function triggerMetadataFetch(url: string, autoSelect = false) {
    // Shared URLs default to the in-app WebView capture flow: the user opens
    // the page (signing in if needed) and screenshots it into the
    // image-extraction flow. Typed URLs still get an inline link preview.
    if (autoSelect) {
      setWebCaptureUrl(url);
      setShowWebCapture(true);
      return;
    }
    setUrlMetadata(null);
    setIsFetchingMetadata(true);
    try {
      const result = await fetchMetadata(url, Constants.userAgent ?? undefined);
      setUrlMetadata(result);
    } catch (e) {
      console.warn("Metadata fetch failed:", e);
      Alert.alert(
        "Unable to fetch link",
        "We were unable to retrieve data for this link at this time.",
      );
    } finally {
      setIsFetchingMetadata(false);
    }
  }

  // Query for searching/listing available contacts
  const { data: searchData, isLoading: isSearching } = useQuery({
    queryKey: ["available-contacts", debouncedSearchText],
    queryFn: async () => {
      if (!debouncedSearchText.trim()) {
        // If no search text, fetch recent/default available contacts
        return getAvailableContacts({ limit: 10, offset: 0 });
      }
      return searchAvailableContacts({
        query: debouncedSearchText,
        limit: 10,
        offset: 0,
      });
    },
    // Keep previous data while searching to avoid flicker
    placeholderData: (previousData) => previousData,
  });
  const availableContacts =
    searchData?.status === 200 ? searchData.data.items : [];

  const handleContactSelect = (contact: (typeof availableContacts)[0]) => {
    setSelectedContact(contact);
    setAvatarMimeType(null);
    setSearchText(contact.name);
    setShowResults(false);
  };

  async function handleScanImage(source: "camera" | "library") {
    const opts: ImagePicker.ImagePickerOptions = {
      base64: true,
      quality: 0.8,
      mediaTypes: "images",
    };
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);

    if (result.canceled || !result.assets[0]?.base64) return;

    const asset = result.assets[0];
    setIsExtractingImage(true);
    try {
      const res = await contactsExtractFromImage({
        image: asset.base64!,
        mimeType: (asset.mimeType ?? "image/jpeg") as any,
      });
      if (!isSuccess(res)) throw new Error("Extraction failed");

      applyExtractedContact(
        res.data as Record<string, string>,
        asset.uri,
        asset.mimeType ?? "image/jpeg",
      );
    } catch {
      Alert.alert(
        "Extraction failed",
        "Unable to read contact info from this image.",
      );
    } finally {
      setIsExtractingImage(false);
    }
  }

  function promptScanImage() {
    Alert.alert("Scan Contact", "Choose a source", [
      { text: "Take Photo", onPress: () => handleScanImage("camera") },
      { text: "Choose Photo", onPress: () => handleScanImage("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  const handleAddContact = async () => {
    const name = selectedContact?.name || searchText.trim();
    if (!name || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const created = await createContactWithAvatar({
        name,
        email: selectedContact?.email || undefined,
        notes: notes || undefined,
        avatarUrl: selectedContact?.avatarUrl ?? undefined,
        avatarMimeType: avatarMimeType ?? undefined,
      });
      if (sharedImageUri) {
        // Eager background fetch so cache is populated when home screen mounts
        queryClient.refetchQueries({ queryKey: contactKeys.all });
        router.replace("/(main)");
      } else {
        queryClient.invalidateQueries({ queryKey: contactKeys.all });
        router.back();
      }
      if (created.avatarUploadFailed) {
        Alert.alert(
          "Photo upload failed",
          "The contact was saved, but the photo couldn't be uploaded. You can try again from the edit screen.",
        );
      }
    } catch (err) {
      console.error("Failed to create contact:", err);
      alert("Failed to create contact. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
        {/* Import from device button */}
        <Pressable
          onPress={() => router.push("/contacts/import")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.primaryLight,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            marginBottom: spacing.lg,
          }}
        >
          <Ionicons
            name="download-outline"
            size={20}
            color={colors.primary}
            style={{ marginRight: spacing.sm }}
          />
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.primary,
              flex: 1,
            }}
          >
            Import from Phone or Google
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
        {/* Scan image button */}
        <Pressable
          onPress={promptScanImage}
          disabled={isExtractingImage || isLoadingExtraction}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.primaryLight,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            marginBottom: spacing.lg,
            opacity: isExtractingImage || isLoadingExtraction ? 0.7 : 1,
          }}
        >
          {isExtractingImage || isLoadingExtraction ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={{ marginRight: spacing.sm }}
            />
          ) : (
            <Ionicons
              name="camera-outline"
              size={20}
              color={colors.primary}
              style={{ marginRight: spacing.sm }}
            />
          )}
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.primary,
              flex: 1,
            }}
          >
            {isExtractingImage || isLoadingExtraction
              ? "Extracting contact info..."
              : "Scan Business Card / Screenshot"}
          </Text>
        </Pressable>
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
                setShowResults(true);
                // Clear selection if user types
                if (selectedContact && text !== selectedContact.name) {
                  setSelectedContact(null);
                }
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
          {showResults && !selectedContact && (
            <View
              style={{
                marginTop: spacing.md,
                backgroundColor: colors.card,
                borderRadius: borderRadius.md,
                overflow: "hidden",
                borderColor: colors.border,
                borderWidth: 1,
                ...shadows.md,
                maxHeight: 250, // Limit height
              }}
            >
              {isSearching ? (
                <View style={{ padding: spacing.md, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : availableContacts.length > 0 ? (
                availableContacts.map((contact, index) => (
                  <Pressable
                    key={contact.id}
                    onPress={() => handleContactSelect(contact)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: spacing.md,
                      borderBottomWidth:
                        index < availableContacts.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Image
                      source={{
                        uri:
                          contact.avatarUrl ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            contact.name,
                          )}&background=random`,
                      }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: borderRadius.full,
                        marginRight: spacing.md,
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          color: colors.textMain,
                          fontWeight: "500",
                        }}
                      >
                        {contact.name}
                      </Text>
                      {contact.email && (
                        <Text
                          style={{
                            fontSize: 12,
                            color: colors.textSecondary,
                          }}
                          numberOfLines={1}
                        >
                          {contact.email}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                ))
              ) : (
                <View style={{ padding: spacing.md }}>
                  <Text
                    style={{ color: colors.textTertiary, textAlign: "center" }}
                  >
                    No contacts found
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* URL Metadata Preview Card */}
        {(isFetchingMetadata || urlMetadata) && !selectedContact && (
          <Pressable
            onPress={() => {
              if (!urlMetadata) return;
              selectFromMetadata(urlMetadata);
            }}
            style={{
              backgroundColor: colors.card,
              borderRadius: borderRadius.lg,
              marginBottom: spacing.lg,
              overflow: "hidden",
              borderColor: colors.border,
              borderWidth: 1,
              ...shadows.md,
            }}
          >
            {isFetchingMetadata ? (
              <View
                style={{
                  padding: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  Fetching link preview...
                </Text>
              </View>
            ) : urlMetadata ? (
              <View style={{ flexDirection: "row" }}>
                {urlMetadata.image ? (
                  <Image
                    source={{ uri: urlMetadata.image }}
                    style={{ width: 80, height: 80 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      backgroundColor: colors.primaryLight,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons name="link" size={32} color={colors.primary} />
                  </View>
                )}
                <View style={{ flex: 1, padding: spacing.md }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: colors.textMain,
                      marginBottom: 2,
                    }}
                    numberOfLines={2}
                  >
                    {urlMetadata.title || "No title"}
                  </Text>
                  {urlMetadata.description ? (
                    <Text
                      style={{ fontSize: 11, color: colors.textSecondary }}
                      numberOfLines={2}
                    >
                      {urlMetadata.description}
                    </Text>
                  ) : null}
                  <Text
                    style={{
                      fontSize: 10,
                      color: colors.textTertiary,
                      marginTop: spacing.xs,
                    }}
                    numberOfLines={1}
                  >
                    Tap to add as contact
                  </Text>
                </View>
              </View>
            ) : null}
          </Pressable>
        )}

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
            <View
              style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
            >
              <Image
                source={{
                  uri:
                    selectedContact.avatarUrl ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      selectedContact.name,
                    )}&background=random`,
                }}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: borderRadius.full,
                  marginRight: spacing.md,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 16,
                    color: colors.card,
                    fontWeight: "600",
                  }}
                >
                  {selectedContact.name}
                </Text>
                {selectedContact.email && (
                  <Text
                    style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}
                    numberOfLines={1}
                  >
                    {selectedContact.email}
                  </Text>
                )}
              </View>
            </View>
            <Pressable
              onPress={() => {
                setSelectedContact(null);
                setAvatarMimeType(null);
                setSearchText("");
              }}
            >
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
          disabled={isSubmitting}
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.border,
            opacity: isSubmitting ? 0.5 : 1,
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
          disabled={(!selectedContact && !searchText.trim()) || isSubmitting}
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
          {isSubmitting ? (
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
            {isSubmitting ? "Adding..." : "Add Contact"}
          </Text>
        </Pressable>
      </View>
      <WebCaptureModal
        visible={showWebCapture}
        url={webCaptureUrl}
        onCaptured={(imageUri, mimeType) => {
          setShowWebCapture(false);
          router.replace({
            pathname: "/contact-screenshot-crop",
            params: { sharedImageUri: imageUri, sharedImageMimeType: mimeType },
          });
        }}
        onClose={() => setShowWebCapture(false)}
      />
    </SafeAreaView>
  );
}
