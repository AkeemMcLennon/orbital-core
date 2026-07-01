import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { Alert } from "react-native";
import { useShareIntent } from "expo-share-intent";

import { extractUrlFromText, isUrl } from "../src/utils/metadata";
import { isVCardFile } from "../src/utils/vcard";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TamaguiProvider } from "tamagui";
import { getContacts, getMemoryReps } from "@orbital/client";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider, useAuthContext } from "../src/contexts/AuthContext";
import { contactKeys } from "../src/queries/contacts";
import { memoryRepKeys } from "../src/queries/memory-reps";
import { colors } from "../src/theme";
import { tamalogui } from "../tamagui.config";
import LoginScreen from "./login";

// Keep the native splash screen visible until we're ready
SplashScreen.preventAutoHideAsync();

// Module level - executes on import, before RootLayout mounts

export const unstable_settings = {
  anchor: "(main)",
};

// Initialize React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
    },
  },
});

/** Shared handler for all incoming deep links (VIEW intents and synthesized share intents). */
function handleDeepLink(url: string) {
  const parsed = Linking.parse(url);
  const route = parsed.path || parsed.hostname;
  if (route === "contact-add") {
    if (parsed.queryParams?.sharedImageUri) {
      router.replace({
        pathname: "/contact-screenshot-crop" as any,
        params: {
          sharedImageUri: parsed.queryParams.sharedImageUri as string,
          sharedImageMimeType:
            (parsed.queryParams.sharedImageMimeType as string) ?? "image/jpeg",
        },
      });
    } else if (parsed.queryParams?.url) {
      router.replace({
        pathname: "/contact-add",
        params: { url: parsed.queryParams.url as string },
      });
    }
  }
}

function AuthGate() {
  const { isReady, isAuthenticated } = useAuthContext();
  const queryClient = useQueryClient();
  const { shareIntent, resetShareIntent } = useShareIntent();

  // Handle Android SEND intent: images go to extract-from-image flow; text/URLs
  // go through the existing URL metadata flow.
  useEffect(() => {
    if (!isAuthenticated || !shareIntent) return;

    // Image share
    const imageFile = shareIntent.files?.[0];
    if (imageFile?.mimeType?.startsWith("image/")) {
      resetShareIntent();
      const link = Linking.createURL("contact-add", {
        queryParams: {
          sharedImageUri: imageFile.path,
          sharedImageMimeType: imageFile.mimeType,
        },
      });
      handleDeepLink(link);
      return;
    }

    // vCard (.vcf) share: pass the file URI to the import screen, which reads,
    // parses, and routes to add-contact (single card) or selection list (multi).
    const file = shareIntent.files?.[0];
    if (isVCardFile(file) && file?.path) {
      resetShareIntent();
      router.replace({
        pathname: "/contacts/import",
        params: { vcfUri: file.path },
      });
      return;
    }

    // Text/URL share: default to the WebView capture flow for any shared URL.
    const sharedText = shareIntent.text || shareIntent.webUrl || "";
    const trimmed = sharedText.trim();

    // expo-share-intent emits a truthy (but empty) intent on normal launch.
    // Only react when content was actually shared.
    if (!imageFile && !trimmed) return;

    const extracted =
      extractUrlFromText(sharedText) ?? (isUrl(trimmed) ? trimmed : null);
    resetShareIntent();
    if (extracted) {
      const link = Linking.createURL("contact-add", {
        queryParams: { url: extracted },
      });
      handleDeepLink(link);
    } else {
      Alert.alert(
        "Unsupported share",
        "Only images and links can be added as contacts.",
      );
    }
  }, [isAuthenticated, shareIntent]);

  useEffect(() => {
    async function prepare() {
      if (!isReady) return;

      if (isAuthenticated) {
        await Promise.all([
          queryClient.prefetchQuery({
            queryKey: contactKeys.all,
            queryFn: () => getContacts({ limit: 50, offset: 0, sort: "date" }),
          }),
          queryClient.prefetchQuery({
            queryKey: memoryRepKeys.all,
            queryFn: () => getMemoryReps(),
          }),
        ]);
      }

      await SplashScreen.hideAsync();

      // Handle VIEW deep links on initial launch
      if (isAuthenticated) {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) handleDeepLink(initialUrl);
      }
    }

    prepare();
  }, [isReady, isAuthenticated, queryClient]);

  // Handle VIEW deep links when the app is already open
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      if (isAuthenticated) handleDeepLink(url);
    });
    return () => sub.remove();
  }, [isAuthenticated]);

  if (!isReady) return null;

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(main)" />
      <Stack.Screen name="contact-screenshot-crop" />
      <Stack.Screen name="contact-add" />
      <Stack.Screen name="contacts/[id]" />
      <Stack.Screen name="contacts/[id]/edit" />
      <Stack.Screen name="tags/[id]" />
      <Stack.Screen name="contacts/import" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="developer-options" />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView
      style={{
        flex: 1,
        backgroundColor: colors.bg,
      }}
    >
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <TamaguiProvider config={tamalogui}>
            <ThemeProvider
              value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
            >
              <AuthProvider>
                <AuthGate />
              </AuthProvider>
            </ThemeProvider>
          </TamaguiProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
