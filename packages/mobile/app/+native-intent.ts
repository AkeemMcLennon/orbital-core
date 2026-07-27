import { getShareExtensionKey } from "expo-share-intent";

/**
 * iOS share extensions cannot pass intent extras, so expo-share-intent wakes the
 * app with a signal URL (`orbital://dataUrl=orbitalShareKey#<type>`) and stashes the
 * real payload in App Group storage. `useShareIntent()` in app/_layout.tsx picks that
 * up via expo-linking and routes it; expo-router must NOT also try to navigate to it,
 * or it renders an Unmatched Route on top of the correct screen.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string | null {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) {
      return null; // swallow: AuthGate's useShareIntent handler drives navigation
    }
    return path;
  } catch {
    return path;
  }
}
