let _waitUntil: ((promise: Promise<unknown>) => void) | undefined;

export function setWaitUntil(fn: (promise: Promise<unknown>) => void): void {
  _waitUntil = fn;
}

export function waitUntil(promise: Promise<unknown>): void {
  const safe = promise.catch((err) => {
    console.error("Background task failed:", err);
  });

  if (_waitUntil) {
    _waitUntil(safe);
  }
  // In Node/Bun, fire-and-forget — the event loop keeps the promise alive.
}
