import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import ExpoImageCropTool from "@bsky.app/expo-image-crop-tool";
import { useExtractImageQuery } from "../src/hooks/useExtractImageQuery";
import { colors } from "../src/theme";

export default function ContactScreenshotCropScreen() {
  const { sharedImageUri, sharedImageMimeType } = useLocalSearchParams<{
    sharedImageUri: string;
    sharedImageMimeType?: string;
  }>();

  // Kick off background extraction immediately while user is cropping.
  // Result is cached in React Query — contact-add will read it on arrival.
  useExtractImageQuery(sharedImageUri, sharedImageMimeType);

  useEffect(() => {
    if (!sharedImageUri) return;

    async function openCropper() {
      try {
        const result = await ExpoImageCropTool.openCropperAsync({
          imageUri: sharedImageUri!,
          format: "jpeg",
          compressImageQuality: 0.9,
          rotationEnabled: true,
        });
        router.replace({
          pathname: "/contact-add",
          params: {
            sharedImageUri: sharedImageUri!,
            sharedImageMimeType: sharedImageMimeType ?? "image/jpeg",
            croppedImageUri: result.path,
          },
        });
      } catch {
        // User cancelled or error — proceed with original image, no avatar crop
        router.replace({
          pathname: "/contact-add",
          params: {
            sharedImageUri: sharedImageUri!,
            sharedImageMimeType: sharedImageMimeType ?? "image/jpeg",
          },
        });
      }
    }

    openCropper();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
