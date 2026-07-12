import React, { useCallback, useRef } from "react";
import { router } from "expo-router";
import { IntroCarousel } from "../src/onboarding/IntroCarousel";
import { markOnboardingCompleted } from "../src/onboarding/completion";

/**
 * Intro tour, shown once after first sign-in (navigated to from the root
 * layout / auth-callback when the completion flag is unset) and replayable
 * from Settings.
 *
 * Deep links and shares always take precedence: their `router.replace()`
 * simply supersedes this route, and the unset flag re-triggers the tour on
 * the next launch.
 */
export default function OnboardingScreen() {
  // Guard against a double-tap on Get started/Skip: a second back() during
  // replay would pop Settings too.
  const doneRef = useRef(false);

  const handleDone = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    // Fire-and-forget: don't delay navigation on a storage write.
    markOnboardingCompleted().catch((err) => {
      console.error("Failed to persist onboarding completion:", err);
    });

    // First-run entry is a replace (single-entry stack, nothing to pop);
    // replay is a push from Settings. Reading the stack directly avoids
    // trusting a param that could go stale on a crafted/stranded deep link.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(main)");
    }
  }, []);

  return <IntroCarousel onDone={handleDone} />;
}
