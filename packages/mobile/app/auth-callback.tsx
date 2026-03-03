import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { View } from "react-native";

/**
 * This route exists to handle the OAuth callback deep link (mobile://auth-callback).
 *
 * In development, expo-auth-session intercepts the callback before the router
 * sees it. In production builds, the deep link arrives as a navigation event
 * that Expo Router must match to a route — without this file, it's "unmatched".
 */
export default function AuthCallback() {
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  return <View />;
}
