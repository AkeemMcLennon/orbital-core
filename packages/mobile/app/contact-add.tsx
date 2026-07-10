import React, { useEffect, useState } from "react";
import {
  Alert,
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounceValue } from "usehooks-ts";
import * as ImagePicker from "expo-image-picker";
import {
  searchAvailableContacts,
  getAvailableContacts,
  contactsExtractFromImage,
  mergeNewContact,
  isSuccess,
  getSuccessData,
} from "@orbital/client";
import {
  useExtractImageQuery,
  type ExtractedContact,
} from "../src/hooks/useExtractImageQuery";
import { contactKeys } from "../src/queries/contacts";
import { createContactWithAvatar } from "../src/lib/createContactWithAvatar";
import { backgroundUploadAvatar } from "../src/lib/uploadAvatar";
import Constants from "expo-constants";
import { colors, spacing, borderRadius, shadows } from "../src/theme";
import {
  fetchMetadata,
  isUrl,
  type MetadataResult,
} from "../src/utils/metadata";
import {
  detectChannelFromUrl,
  SOCIAL_LINK_META,
  type SocialLinkType,
} from "../src/utils/socialLinks";
import { SocialLinkIcon } from "../src/components/SocialLinkIcon";
import { WebCaptureModal } from "../src/components/WebCaptureModal";
import { ContactPickerModal } from "../src/components/ContactPickerModal";
import { StrengthSelector } from "../src/components/StrengthSelector";
import { useVCardQuery } from "../src/hooks/useVCardQuery";
import { planPrefill } from "../src/import/funnel";
import type { ImportedContact } from "../src/import/types";

export default function AddContactScreen() {
  const {
    url: deepLinkUrl,
    sharedImageUri,
    sharedImageMimeType,
    croppedImageUri,
    vcfUri,
  } = useLocalSearchParams<{
    url?: string;
    sharedImageUri?: string;
    sharedImageMimeType?: string;
    croppedImageUri?: string;
    vcfUri?: string;
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
  const [strength, setStrength] = useState(0);
  const [isExtractingImage, setIsExtractingImage] = useState(false);
  const [avatarMimeType, setAvatarMimeType] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWebCapture, setShowWebCapture] = useState(false);
  const [webCaptureUrl, setWebCaptureUrl] = useState("");
  const [detectedLink, setDetectedLink] = useState<{
    type: SocialLinkType;
    value: string;
  } | null>(null);
  const [showMergeDestPicker, setShowMergeDestPicker] = useState(false);
  const queryClient = useQueryClient();
  // If arriving from contact-screenshot-crop, extraction may already be cached
  const {
    data: extractedData,
    isLoading: isLoadingExtraction,
    isError: isExtractionError,
  } = useExtractImageQuery(sharedImageUri, sharedImageMimeType);

  // Prefill the form from any import source. All folding (extras + notes +
  // birthday into the notes field), link detection, and avatar mime handling
  // happens once in `planPrefill`; this just applies the result to UI state.
  function applyImportedContact(contact: ImportedContact) {
    const plan = planPrefill(contact);
    setSearchText(plan.name);
    setSelectedContact({
      id: `imported:${Date.now()}`,
      name: plan.name,
      email: plan.email,
      avatarUrl: plan.avatarUrl,
    });
    setAvatarMimeType(plan.avatarMimeType);
    setShowResults(false);
    if (plan.notes) setNotes(plan.notes);
    if (plan.detectedLink) setDetectedLink(plan.detectedLink);
  }

  // Pre-fill from deep link url param on mount. When arriving back from the
  // capture → crop round-trip the url is accompanied by sharedImageUri; only
  // re-detect the link then, without re-opening the capture flow.
  useEffect(() => {
    if (deepLinkUrl) {
      const channel = detectChannelFromUrl(deepLinkUrl);
      if (channel) setDetectedLink(channel);
      if (!sharedImageUri) {
        // Don't fill the name field with a social URL — the channel handle is
        // in detectedLink; typing a URL as the contact name query makes no sense
        // and causes the debounce effect to loop on the metadata fetch.
        if (
          !channel ||
          channel.type === "website" ||
          channel.type === "other"
        ) {
          setSearchText(deepLinkUrl);
        }
        triggerMetadataFetch(deepLinkUrl, true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefill from a shared .vcf file: map the first parsed card (from the hook,
  // which also materializes its avatar) into the shared import funnel.
  const { data: vcards } = useVCardQuery(vcfUri);
  useEffect(() => {
    if (!vcards) return;
    const { card, avatar } = vcards[0];
    applyImportedContact({
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
          ? { kind: "remote", url: avatar.uri }
          : { kind: "local", uri: avatar.uri, mimeType: avatar.mimeType }
        : undefined,
    });
  }, [vcards]);

  // Populate form when shared-image extraction completes (may be instant from cache)
  useEffect(() => {
    if (isExtractionError) {
      Alert.alert(
        "Extraction failed",
        "Unable to read contact info from this image.",
      );
      return;
    }
    if (!extractedData) return;
    applyImportedContact({
      name: extractedData.name || "Unknown",
      email: extractedData.email,
      phone: extractedData.phone,
      company: extractedData.company,
      jobTitle: extractedData.jobTitle,
      rawLinks: extractedData.linkedinUrl
        ? [extractedData.linkedinUrl]
        : undefined,
      avatar: croppedImageUri
        ? croppedImageUri.startsWith("http")
          ? { kind: "remote", url: croppedImageUri }
          : { kind: "local", uri: croppedImageUri, mimeType: "image/jpeg" }
        : undefined,
    });
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
    const channel = detectChannelFromUrl(metadata.url);
    applyImportedContact({
      name: metadata.title || metadata.url,
      notes: metadata.description ?? undefined,
      links: channel && channel.type !== "website" ? [channel] : undefined,
      avatar: metadata.image
        ? { kind: "remote", url: metadata.image }
        : undefined,
    });
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

      const extracted = res.data as ExtractedContact;
      applyImportedContact({
        name: extracted.name || "Unknown",
        email: extracted.email,
        phone: extracted.phone,
        company: extracted.company,
        jobTitle: extracted.jobTitle,
        rawLinks: extracted.linkedinUrl ? [extracted.linkedinUrl] : undefined,
        avatar: asset.uri.startsWith("http")
          ? { kind: "remote", url: asset.uri }
          : {
              kind: "local",
              uri: asset.uri,
              mimeType: asset.mimeType ?? "image/jpeg",
            },
      });
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

  const mergeMutation = useMutation({
    mutationFn: async (destinationId: string) => {
      // The server owns merge semantics: it fills only the destination's empty
      // scalar fields, additively de-dups links, and adopts (and enriches)
      // notes only when the destination has none. So we just hand it the
      // preloaded contact as the source.
      //
      // A remote avatar is a URL the server can adopt directly; a local file://
      // URI (e.g. from image extraction) isn't a valid URL for the endpoint and
      // is uploaded afterward via the presigned-R2 flow the create path uses.
      const avatar = selectedContact?.avatarUrl ?? undefined;
      const avatarIsLocal = !!avatar && !avatar.startsWith("http");

      const res = await mergeNewContact(destinationId, {
        source: {
          email: selectedContact?.email || undefined,
          notes: notes || undefined,
          strength,
          avatarUrl: avatar && !avatarIsLocal ? avatar : undefined,
          links: detectedLink
            ? [{ type: detectedLink.type, value: detectedLink.value }]
            : undefined,
        },
      });
      const merged = getSuccessData(res);
      if (!merged) throw new Error("Merge failed");

      // Local avatar: upload only when the merge left the destination without
      // one (the server preserves an existing avatar, so the merged result's
      // empty avatarUrl means it had none). Uploading otherwise would overwrite
      // the destination's photo. Deferred to onSuccess so it runs in the
      // background with an optimistic preview, like the create path.
      const localAvatarUri =
        avatarIsLocal && avatar && !merged.avatarUrl ? avatar : undefined;

      return { destinationId, localAvatarUri };
    },
    onSuccess: ({ destinationId, localAvatarUri }) => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
      router.back();
      if (localAvatarUri) {
        // The upload swaps the cached avatarUrl between the local preview and
        // the real URL itself; we only handle the failure alert.
        backgroundUploadAvatar(
          queryClient,
          destinationId,
          localAvatarUri,
          avatarMimeType ?? "image/jpeg",
        ).catch(() =>
          Alert.alert(
            "Photo upload failed",
            "The contact was merged, but the photo couldn't be uploaded. You can try again from the edit screen.",
          ),
        );
      }
    },
    onError: () =>
      Alert.alert(
        "Merge Failed",
        "Unable to merge contacts. Please try again.",
      ),
  });

  const handleMergeIntoExisting = (
    destinationId: string,
    destinationName: string,
  ) => {
    Alert.alert(
      "Merge into Contact",
      `Merge into "${destinationName}"?\n\nEmpty fields in "${destinationName}" will be filled from this preloaded contact.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Merge",
          onPress: () => mergeMutation.mutate(destinationId),
        },
      ],
    );
  };

  const handleAddContact = async () => {
    const name = selectedContact?.name || searchText.trim();
    if (!name || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const created = await createContactWithAvatar(queryClient, {
        name,
        email: selectedContact?.email || undefined,
        notes: notes || undefined,
        strength,
        avatarUrl: selectedContact?.avatarUrl ?? undefined,
        avatarMimeType: avatarMimeType ?? undefined,
        links:
          detectedLink && detectedLink.value.trim()
            ? [{ type: detectedLink.type, value: detectedLink.value.trim() }]
            : undefined,
      });
      if (sharedImageUri) {
        // Eager background fetch so cache is populated when home screen mounts
        queryClient.refetchQueries({ queryKey: contactKeys.all });
        router.replace("/(main)");
      } else {
        queryClient.invalidateQueries({ queryKey: contactKeys.all });
        router.back();
      }
      // The avatar uploads in the background; the upload itself swaps the
      // cached avatarUrl between the local preview and the real URL. We only
      // alert on failure, without blocking the flow the user already completed.
      created.avatarUpload?.catch(() =>
        Alert.alert(
          "Photo upload failed",
          "The contact was saved, but the photo couldn't be uploaded. You can try again from the edit screen.",
        ),
      );
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
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
                accessibilityLabel="Search or enter a contact name"
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
                      style={{
                        color: colors.textTertiary,
                        textAlign: "center",
                      }}
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
                  {detectedLink && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.xs,
                        marginTop: spacing.xs,
                      }}
                    >
                      <SocialLinkIcon
                        type={detectedLink.type}
                        size={14}
                        color="rgba(255,255,255,0.8)"
                      />
                      <Text
                        style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}
                      >
                        {SOCIAL_LINK_META[detectedLink.type].label}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <Pressable
                onPress={() => {
                  setSelectedContact(null);
                  setAvatarMimeType(null);
                  setSearchText("");
                  setDetectedLink(null);
                }}
              >
                <Ionicons name="close" size={20} color={colors.card} />
              </Pressable>
            </View>
          )}

          {/* Merge into existing — only visible when contact is preloaded */}
          {selectedContact && (
            <Pressable
              onPress={() => setShowMergeDestPicker(true)}
              disabled={mergeMutation.isPending}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.primaryLight,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                marginBottom: spacing.lg,
                opacity: mergeMutation.isPending ? 0.7 : 1,
              }}
            >
              {mergeMutation.isPending ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={{ marginRight: spacing.sm }}
                />
              ) : (
                <Ionicons
                  name="git-merge-outline"
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
                {mergeMutation.isPending
                  ? "Merging..."
                  : "Merge into Existing Contact"}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.primary}
              />
            </Pressable>
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

          {/* Relationship Strength */}
          <StrengthSelector
            value={strength}
            onChange={setStrength}
            label="Relationship Strength"
          />
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
            accessibilityRole="button"
            accessibilityLabel="Add Contact"
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
      </KeyboardAvoidingView>
      <ContactPickerModal
        open={showMergeDestPicker}
        onClose={() => setShowMergeDestPicker(false)}
        onSelect={handleMergeIntoExisting}
        title="Select Contact to Merge Into"
      />
      <WebCaptureModal
        visible={showWebCapture}
        url={webCaptureUrl}
        onCaptured={(imageUri, mimeType) => {
          setShowWebCapture(false);
          router.replace({
            pathname: "/contact-screenshot-crop",
            params: {
              sharedImageUri: imageUri,
              sharedImageMimeType: mimeType,
              // Keep the original shared URL so the detected social link
              // survives the crop round-trip back to this screen.
              url: webCaptureUrl,
            },
          });
        }}
        onClose={() => setShowWebCapture(false)}
      />
    </SafeAreaView>
  );
}
