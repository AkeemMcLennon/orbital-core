import * as storage from "../utils/storage";
import { ONBOARDING_KEY } from "./constants";

// In-memory mirror of the persisted flag. Once onboarding is completed in a
// session, the dashboard guard sees it immediately (synchronously, before the
// storage write resolves), so returning from the tour never redirects back
// into it. `null` = not yet read from storage this session.
let completedCache: boolean | null = null;

/** Synchronously known completion state, or `null` if storage hasn't been read yet. */
export function onboardingCompletedCached(): boolean | null {
  return completedCache;
}

/** Whether the user has completed (or skipped) the intro tour. */
export async function readOnboardingCompleted(): Promise<boolean> {
  if (completedCache !== null) return completedCache;
  completedCache = (await storage.getItem(ONBOARDING_KEY)) === "true";
  return completedCache;
}

/** Persist intro-tour completion. Versioned key — see ONBOARDING_KEY. */
export async function markOnboardingCompleted(): Promise<void> {
  completedCache = true;
  await storage.setItem(ONBOARDING_KEY, "true");
}

/** Test-only: reset the in-memory cache between cases. */
export function __resetOnboardingCache(): void {
  completedCache = null;
}
