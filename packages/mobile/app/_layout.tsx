import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import {
  MutationCache,
  QueryCache,
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
import { isRetryableError } from "@orbital/client";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider, useAuthContext } from "../src/contexts/AuthContext";
import { contactsListOptions } from "../src/queries/contacts";
import { memoryRepsListOptions } from "../src/queries/memory-reps";
import { colors } from "../src/theme";
import { logApiError } from "../src/utils/errors";
import { ToastHost } from "../src/components/ToastHost";
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
      // Only retry what could plausibly succeed on a second attempt. Without
      // this, react-query's default (3x exponential) would retry a 404 for
      // ~7s before the user sees anything, and would re-enter the token
      // refresh path three extra times on a 401.
      retry: (count, error) => count < 2 && isRetryableError(error),
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
      // Query failures render inline via <ErrorState />; they must not blow up
      // to an error boundary.
      throwOnError: false,
    },
    mutations: { retry: 0, throwOnError: false },
  },
  // Log only. Presentation stays at the call site — alerting here too would
  // double-report for the mutations that already handle their own onError.
  queryCache: new QueryCache({
    onError: (error, query) =>
      logApiError("query", error, { queryKey: query.queryKey }),
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) =>
      logApiError("mutation", error, {
        mutationKey: mutation.options.mutationKey,
      }),
  }),
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

    const file = shareIntent.files?.[0];
    const sharedText = shareIntent.text || shareIntent.webUrl || "";
    const trimmed = sharedText.trim();

    // expo-share-intent emits a truthy (but empty) intent on normal launch.
    // Only react when content was actually shared.
    if (!file && !trimmed) return;

    // Image share
    if (file?.mimeType?.startsWith("image/")) {
      resetShareIntent();
      const link = Linking.createURL("contact-add", {
        queryParams: {
          sharedImageUri: file.path,
          sharedImageMimeType: file.mimeType,
        },
      });
      handleDeepLink(link);
      return;
    }

    // vCard (.vcf) share: pass the file URI to the import screen, which reads,
    // parses, and routes to add-contact (single card) or selection list (multi).
    if (isVCardFile(file) && file?.path) {
      resetShareIntent();
      router.replace({
        pathname: "/contacts/import",
        params: { vcfUri: file.path },
      });
      return;
    }

    // Text/URL share: default to the WebView capture flow for any shared URL.
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
        "Only contact cards, images, and links can be added as contacts.",
      );
    }
  }, [isAuthenticated, shareIntent]);

  useEffect(() => {
    async function prepare() {
      if (!isReady) return;

      if (isAuthenticated) {
        await Promise.all([
          queryClient.prefetchQuery(
            contactsListOptions({ limit: 50, offset: 0, sort: "date" }),
          ),
          queryClient.prefetchQuery(memoryRepsListOptions()),
        ]);
      }

      await SplashScreen.hideAsync();

      // Handle VIEW deep links on initial launch (a shared URL still opens the
      // capture flow). Post-auth onboarding routing is handled explicitly above.
      if (isAuthenticated) {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) handleDeepLink(initialUrl);
      }
    }

    prepare();
  }, [isReady, isAuthenticated, queryClient]);

  // Handle VIEW deep links when the app is already open.
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
      {/* First-run intro tour; swipe-back disabled so it can't be dismissed
          without completing (Android back exiting the app is fine). */}
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      <Stack.Screen name="contact-screenshot-crop" />
      <Stack.Screen name="contact-add" />
      <Stack.Screen name="contacts/[id]" />
      <Stack.Screen name="contacts/[id]/edit" />
      <Stack.Screen name="tags/[id]" />
      <Stack.Screen name="contacts/import" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="memory-rep-frequency" />
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
            <ToastHost>
              <ThemeProvider
                value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
              >
                <AuthProvider>
                  <AuthGate />
                </AuthProvider>
              </ThemeProvider>
            </ToastHost>
          </TamaguiProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
