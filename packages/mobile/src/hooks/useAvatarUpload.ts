import { useState } from "react";
import { Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { getAvatarUploadUrl, updateContact } from "@orbital/client";
import { contactKeys } from "../queries/contacts";

type PickedImage = {
  uri: string;
  mimeType: string;
};

async function pickImage(
  source: "camera" | "library",
): Promise<PickedImage | null> {
  const options: ImagePicker.ImagePickerOptions = {
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    mediaTypes: "images",
  };

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? "image/jpeg",
  };
}

export function useAvatarUpload(contactId: string) {
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();

  const upload = async (source: "camera" | "library") => {
    const picked = await pickImage(source);
    if (!picked) return;

    setIsUploading(true);
    try {
      const blob = await (await fetch(picked.uri)).blob();

      const urlRes = await getAvatarUploadUrl(contactId, {
        contentType: picked.mimeType as any,
        contentLength: blob.size,
      });
      if (urlRes.status !== 200) throw new Error("Failed to get upload URL");
      const { uploadUrl, publicUrl } = urlRes.data;

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": picked.mimeType,
          "Content-Length": String(blob.size),
        },
        body: blob,
      });
      if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`);

      await updateContact(contactId, { avatarUrl: publicUrl });
      queryClient.invalidateQueries({
        queryKey: contactKeys.detail(contactId),
      });
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
    } catch (err) {
      console.error("Avatar upload failed:", err);
      alert("Failed to update avatar. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const onEdit = () => {
    if (Platform.OS === "web") {
      // TODO: Fix super permissive CORS headers on bucket
      upload("library");
    } else {
      Alert.alert("Update Photo", "Choose a source", [
        { text: "Take Photo", onPress: () => upload("camera") },
        { text: "Choose Photo", onPress: () => upload("library") },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  return { onEdit, isUploading };
}
