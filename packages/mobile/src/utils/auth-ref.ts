let logoutHandler: (() => Promise<void>) | null = null;

export function setLogoutHandler(fn: () => Promise<void>) {
  logoutHandler = fn;
}

export async function triggerLogout() {
  if (logoutHandler) {
    await logoutHandler();
  } else {
    console.warn("[auth-ref] No logout handler registered");
  }
}
