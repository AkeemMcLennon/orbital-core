// Background-task helper for fire-and-forget work (e.g. Meilisearch indexing).
//
// On Cloudflare Workers, background work MUST be tied to the request's execution
// context via `ctx.waitUntil`, or it is cancelled once the response is sent. The
// execution context is per-request, so we build a `waitUntil` bound to each request
// (in app.ts) and thread it through the handler context — never a module-level
// global, which gets clobbered across concurrent requests and silently drops work.

export type WaitUntil = (promise: Promise<unknown>) => void;

// Optional observer so tests can await background tasks. Set only in test setup.
let observer: ((promise: Promise<unknown>) => void) | undefined;

export function setBackgroundTaskObserver(
  fn: ((promise: Promise<unknown>) => void) | undefined,
): void {
  observer = fn;
}

/**
 * Builds a request-scoped `waitUntil`. `ctxWaitUntil` is the Worker execution
 * context's `waitUntil` when available; on Node/Bun it is undefined and the
 * promise runs fire-and-forget on the event loop (which keeps it alive).
 */
export function createWaitUntil(ctxWaitUntil?: WaitUntil): WaitUntil {
  return (promise) => {
    const safe = promise.catch((err) => {
      console.error("Background task failed:", err);
    });
    observer?.(safe);
    if (ctxWaitUntil) {
      ctxWaitUntil(safe);
    }
  };
}
