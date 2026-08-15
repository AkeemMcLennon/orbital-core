let logoutHandler: (() => Promise<void>) | null = null;

// In-flight logout, so concurrent 401s collapse into a single sign-out.
let logoutInFlight: Promise<void> | null = null;

export function setLogoutHandler(fn: () => Promise<void>) {
  logoutHandler = fn;
}

/**
 * Sign the user out once, however many callers ask.
 *
 * `customFetch` invokes `onUnauthorized` for every failed request and — unlike
 * the token refresh, which is deduplicated — that call is not. So N parallel
 * queries hitting a stale token would otherwise trigger N sign-outs.
 */
export async function triggerLogout() {
  if (!logoutHandler) {
    console.warn("[auth-ref] No logout handler registered");
    return;
  }

  if (!logoutInFlight) {
    logoutInFlight = Promise.resolve(logoutHandler()).finally(() => {
      logoutInFlight = null;
    });
  }

  return logoutInFlight;
}
