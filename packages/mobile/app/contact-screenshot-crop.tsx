import { View, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { RNMLKitFaceDetectionContextProvider } from "@infinitered/react-native-mlkit-face-detection";
import { useFaceCropFlow } from "../src/hooks/useFaceCropFlow";
import { colors } from "../src/theme";

export default function ContactScreenshotCropScreen() {
  const { sharedImageUri, sharedImageMimeType } = useLocalSearchParams<{
    sharedImageUri: string;
    sharedImageMimeType?: string;
  }>();

  return (
    <RNMLKitFaceDetectionContextProvider>
      <CropFlow
        sharedImageUri={sharedImageUri}
        sharedImageMimeType={sharedImageMimeType}
      />
    </RNMLKitFaceDetectionContextProvider>
  );
}

function CropFlow({
  sharedImageUri,
  sharedImageMimeType,
}: {
  sharedImageUri: string;
  sharedImageMimeType?: string;
}) {
  useFaceCropFlow(sharedImageUri, sharedImageMimeType);

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
