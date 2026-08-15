/* eslint-disable @typescript-eslint/no-require-imports */

// ── Root layout → minimal Slot + QueryClientProvider ──
jest.mock("../app/_layout", () => {
  const React = require("react");
  const { Slot } = require("expo-router");
  const { QueryClient, QueryClientProvider } = require("@tanstack/react-query");
  const { AuthProvider } = require("../src/contexts/AuthContext");

  // Named (not inline) so eslint's rules-of-hooks recognizes it as a component.
  function MockRootLayout() {
    // A fresh client per mount, so cached data cannot leak from one test to the
    // next. A module-scoped client is shared across every test in a file, which
    // makes error-state assertions see stale data from earlier tests.
    const [queryClient] = React.useState(
      () =>
        new QueryClient({
          defaultOptions: {
            queries: { retry: false, staleTime: 0, gcTime: 0 },
          },
        }),
    );
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(AuthProvider, null, React.createElement(Slot)),
    );
  }

  return { __esModule: true, default: MockRootLayout };
});

// ── Main (Drawer) layout → minimal Slot ──
jest.mock("../app/(main)/_layout", () => {
  const React = require("react");
  const { Slot } = require("expo-router");
  return {
    __esModule: true,
    default: () => React.createElement(Slot),
  };
});

// ── Mobile API config (runs at import-time in _layout) ──
jest.mock("../src/api/config", () => ({
  configureMobileApi: jest.fn(() => Promise.resolve()),
  getCurrentBaseUrl: jest.fn(() =>
    Promise.resolve("http://localhost:8787/rpc"),
  ),
  refreshAccessToken: jest.fn(() => Promise.resolve(null)),
  getToken: jest.fn(() => Promise.resolve("")),
  DEFAULT_AUTH_CONFIG: {
    issuerUrl: "https://auth.example.com",
    clientId: "orbital-mobile",
    scopes: ["openid", "profile", "email", "offline_access"],
  },
  STORAGE_KEYS: {
    accessToken: "auth_token",
    refreshToken: "auth_refresh_token",
    authIssuerUrl: "auth_issuer_url",
    authClientId: "auth_client_id",
  },
}));

// ── Better Auth client (avoid loading ESM better-auth in tests) ──
jest.mock("../src/lib/auth-client", () => ({
  __esModule: true,
  authClient: {
    useSession: () => ({ data: null, isPending: false }),
    signIn: {
      email: jest.fn(() => Promise.resolve({ error: null })),
      social: jest.fn(() => Promise.resolve({ error: null })),
    },
    signUp: {
      email: jest.fn(() => Promise.resolve({ error: null })),
    },
    signOut: jest.fn(() => Promise.resolve()),
  },
  getBearerToken: jest.fn(() => Promise.resolve(null)),
}));

// ── NativeSourceCode (getDevServer needs scriptURL) ──
jest.mock(
  "react-native/Libraries/NativeModules/specs/NativeSourceCode",
  () => ({
    __esModule: true,
    default: {
      getConstants: () => ({
        scriptURL: "http://localhost:8081/index.bundle?platform=ios",
      }),
    },
  }),
);

// ── react-native-safe-area-context ──
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: (props: any) => React.createElement(View, props),
    SafeAreaProvider: ({ children }: any) =>
      React.createElement(View, null, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// ── react-native-gesture-handler ──
jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    GestureHandlerRootView: (props: any) => React.createElement(View, props),
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    PanGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    NativeViewGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    ScrollView: View,
    Slider: View,
    Switch: View,
    TextInput: View,
    ToolbarAndroid: View,
    ViewPagerAndroid: View,
    DrawerLayoutAndroid: View,
    WebView: View,
    NativeGesture: {},
    gestureHandlerRootHOC: jest.fn((component: any) => component),
    Directions: {},
  };
});

// ── react-native-reanimated ──
jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock"),
);

// Route tests render the dashboard directly (the real AuthGate is mocked out),
// so treat onboarding as already completed to skip the root-route redirect.
// Tests that exercise the onboarding flow reset this via the completion module.
require("../src/onboarding/completion").markOnboardingCompleted();

// ── tamagui ──
jest.mock("tamagui", () => {
  const React = require("react");
  const { View, Text, Image } = require("react-native");

  const AvatarImage = (props: any) => React.createElement(Image, props);
  const AvatarFallback = ({ children, ...props }: any) =>
    React.createElement(View, props, children);
  const Avatar = Object.assign(
    ({ children, ...props }: any) => React.createElement(View, props, children),
    { Image: AvatarImage, Fallback: AvatarFallback },
  );

  const TabsTab = ({ children, onInteraction, value, ...props }: any) =>
    React.createElement(View, props, children);
  const TabsList = ({ children, ...props }: any) =>
    React.createElement(View, props, children);
  const Tabs = Object.assign(
    ({ children, onValueChange, ...props }: any) =>
      React.createElement(View, props, children),
    { List: TabsList, Tab: TabsTab, Content: View },
  );

  // Generic passthrough used for the Dialog/Sheet compound members below.
  const Passthrough = ({ children, ...props }: any) =>
    React.createElement(View, props, children);

  const Sheet = Object.assign(
    ({ children, ...props }: any) => React.createElement(View, props, children),
    {
      Overlay: Passthrough,
      Handle: Passthrough,
      Frame: Passthrough,
      ScrollView: Passthrough,
    },
  );
  const Adapt = Object.assign(
    ({ children, ...props }: any) => React.createElement(View, props, children),
    { Contents: Passthrough },
  );
  // Mirror the real Dialog: render content only when `open`, so a closed dialog
  // (the default on screens that mount it) contributes nothing to the test tree.
  const Dialog = Object.assign(
    ({ open, children, ...props }: any) =>
      open ? React.createElement(View, props, children) : null,
    {
      Portal: Passthrough,
      Overlay: Passthrough,
      Content: Passthrough,
      Trigger: Passthrough,
      Title: Passthrough,
      Description: Passthrough,
      Close: Passthrough,
    },
  );

  return {
    Avatar,
    Tabs,
    Sheet,
    Adapt,
    Dialog,
    Input: Passthrough,
    TamaguiProvider: ({ children }: any) => children,
    useMedia: () => ({ gtMd: false }),
    styled: (component: any) => component,
    Text,
    View,
  };
});

// ── @tamagui/toast ──
// ToastHost mounts these at the root; without a mock any screen test that
// renders the real layout would fail on the missing native/animation deps.
jest.mock("@tamagui/toast", () => {
  const React = require("react");
  const { View, Text } = require("react-native");

  const Passthrough = ({ children, ...props }: any) =>
    React.createElement(View, props, children);
  const Toast = Object.assign(
    ({ children, ...props }: any) => React.createElement(View, props, children),
    { Title: Text, Description: Text },
  );

  return {
    Toast,
    ToastProvider: ({ children }: any) => children,
    ToastViewport: () => null,
    // Records shows so tests can assert on toast content if needed.
    useToastController: () => ({ show: jest.fn(), hide: jest.fn() }),
    useToastState: () => null,
    ToastImperativeProvider: Passthrough,
  };
});

// ── @expo/vector-icons ──
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    Ionicons: (props: any) =>
      React.createElement(Text, props, props.name || ""),
  };
});

// ── @expo/vector-icons/MaterialIcons ──
jest.mock("@expo/vector-icons/MaterialIcons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: (props: any) => React.createElement(Text, props, props.name || ""),
  };
});

// ── expo-constants ──
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      hostUri: "localhost:8081",
    },
  },
}));

// ── expo-status-bar ──
jest.mock("expo-status-bar", () => ({
  StatusBar: () => null,
}));

// ── color-hash ──
jest.mock("color-hash", () => {
  return class ColorHash {
    hex() {
      return "#4F46E5";
    }
    hsl() {
      return [240, 50, 50];
    }
    rgb() {
      return [79, 70, 229];
    }
  };
});

// ── expo-image ──
jest.mock("expo-image", () => {
  const React = require("react");
  const { Image } = require("react-native");
  return {
    Image: (props: any) => React.createElement(Image, props),
  };
});

// ── @/hooks/use-color-scheme ──
jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

// ── tamagui config ──
jest.mock("../tamagui.config", () => ({
  tamalogui: {},
}));

// ── expo-image-picker ──
jest.mock("expo-image-picker", () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(() => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(() => ({ granted: true })),
}));

// ── expo-haptics ──
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

// ── expo-symbols ──
jest.mock("expo-symbols", () => ({}));

// ── expo-contacts ──
jest.mock("expo-contacts", () => ({
  requestPermissionsAsync: jest.fn(() => ({ status: "granted" })),
  getContactsAsync: jest.fn(() => ({ data: [] })),
  Fields: {},
}));

// ── expo-crypto ──
jest.mock("expo-crypto", () => ({
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  getRandomBytes: jest.fn(() => new Uint8Array(32)),
  getRandomValues: jest.fn((arr: any) => arr),
}));

// ── expo-auth-session ──
jest.mock("expo-auth-session", () => ({
  useAutoDiscovery: jest.fn(() => null),
  useAuthRequest: jest.fn(() => [null, null, jest.fn()]),
  makeRedirectUri: jest.fn(() => "exp://localhost:8081/--/auth"),
  AuthRequest: jest.fn(),
  fetchDiscoveryAsync: jest.fn(),
  Prompt: { Login: "login", Consent: "consent" },
  ResponseType: { Code: "code" },
  CodeChallengeMethod: { S256: "S256" },
}));

// ── expo-web-browser ──
jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(),
  openAuthSessionAsync: jest.fn(),
  maybeCompleteAuthSession: jest.fn(),
}));

// ── expo-file-system (File class API) ──
jest.mock("expo-file-system", () => ({
  File: class {
    base64() {
      return Promise.resolve("");
    }
  },
  Directory: class {},
}));

// ── react-native-webview ──
jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  const WebView = (props: any) => React.createElement(View, props);
  return { __esModule: true, WebView, default: WebView };
});

// ── react-native-view-shot ──
jest.mock("react-native-view-shot", () => ({
  captureRef: jest.fn(() => Promise.resolve("file:///tmp/capture.jpg")),
}));

// ── expo-share-intent ──
// `app/+native-intent.ts` imports this at module scope, and expo-router's route
// scan loads that file — which pulls in the real expo-linking and fails on
// `Cannot find native module 'ExpoLinking'`. Mocking it here is what lets any
// test that renders the route tree (renderAppRoute) work at all.
jest.mock("expo-share-intent", () => ({
  getShareExtensionKey: () => "orbitalShareKey",
  useShareIntent: () => ({
    shareIntent: null,
    resetShareIntent: jest.fn(),
    error: null,
  }),
}));

// ── expo-linking ──
jest.mock("expo-linking", () => ({
  createURL: jest.fn((path: string) => `exp://localhost:8081/${path}`),
  openURL: jest.fn(),
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  parse: jest.fn((_url: string) => ({ path: null, queryParams: {} })),
}));
