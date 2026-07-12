import React from "react";
import { Image, View } from "react-native";
import { useResponsivePreviewSpacing } from "../useResponsivePreviewSpacing";
import { SlideLayout } from "./SlideLayout";

// Matches the login screen's logo (app/login.tsx): same asset, same aspect ratio.
const LOGO_ASPECT_RATIO = 10792 / 6341;
const LOGO_WIDTH = 220;

/** Opening slide: a warm welcome and the app's core promise. */
export function WelcomeSlide() {
  const previewSpacing = useResponsivePreviewSpacing();

  return (
    <SlideLayout
      title="Welcome to Orbital"
      subtitle="Your personal relationship manager. Stay close to the people you care about, without letting anyone slip."
      previewSpacing={previewSpacing}
    >
      <View style={{ alignItems: "center" }}>
        <Image
          source={require("../../../assets/images/logo.png")}
          style={{ width: LOGO_WIDTH, height: LOGO_WIDTH / LOGO_ASPECT_RATIO }}
          resizeMode="contain"
        />
      </View>
    </SlideLayout>
  );
}
