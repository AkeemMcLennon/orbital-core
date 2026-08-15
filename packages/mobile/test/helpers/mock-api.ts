import * as http from "node:http";
import { initializeApiClient } from "@orbital/client";

/**
 * In-process mock of the Orbital API, used by query-layer tests.
 *
 * Deliberately a REAL HTTP server rather than a module mock: requests travel
 * through `customFetch` exactly as in production, so these tests are agnostic to
 * whether an API error surfaces as a `{status, data}` envelope or a thrown
 * `ApiError`. That is what lets the same success-path assertions guard the
 * migration from one to the other.
 *
 * Uses `node:http` (not `Bun.serve`, as `packages/backend/test/fixtures` does)
 * because the mobile suite runs under jest, where `Bun` does not exist.
 */

export type MockResponse = {
  status: number;
  /** JSON-serialized into the body. Ignored when `raw` is set. */
  body?: unknown;
  /** Emit this exact string instead of JSON — for non-JSON/empty-body cases. */
  raw?: string;
  /** Delay before responding, for loading-state assertions. */
  delayMs?: number;
};

export type RecordedCall = {
  method: string;
  /** Pathname only, no query string. */
  path: string;
  /** Full path including query string. */
  url: string;
  query: Record<string, string>;
  body?: unknown;
};

type Responder = MockResponse | ((call: RecordedCall) => MockResponse);

export type MockApi = {
  /** Base URL to hand to `initializeApiClient`. */
  url: string;
  /** Register a responder for a method + pathname (query string ignored). */
  when(method: string, path: string, responder: Responder): void;
  /** Recorded requests, optionally filtered to one pathname. */
  calls(path?: string): RecordedCall[];
  /** Drop all routes and recorded calls. Call between tests. */
  reset(): void;
  stop(): Promise<void>;
};

const routeKey = (method: string, path: string) =>
  `${method.toUpperCase()} ${path}`;

export async function startMockApi(): Promise<MockApi> {
  const routes = new Map<string, Responder>();
  const recorded: RecordedCall[] = [];

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const rawUrl = req.url ?? "/";
      // `host` is irrelevant — only used so URL can parse a relative path.
      const parsed = new URL(rawUrl, "http://localhost");
      const rawBody = Buffer.concat(chunks).toString("utf8");

      let body: unknown;
      if (rawBody) {
        try {
          body = JSON.parse(rawBody);
        } catch {
          body = rawBody;
        }
      }

      const call: RecordedCall = {
        method: (req.method ?? "GET").toUpperCase(),
        path: parsed.pathname,
        url: rawUrl,
        query: Object.fromEntries(parsed.searchParams.entries()),
        body,
      };
      recorded.push(call);

      const responder = routes.get(routeKey(call.method, call.path));

      // Unregistered routes 404 loudly so a typo'd path is obvious rather than
      // silently looking like an empty result.
      const result: MockResponse = !responder
        ? {
            status: 404,
            body: {
              message: `mock-api: no route for ${call.method} ${call.path}`,
            },
          }
        : typeof responder === "function"
          ? responder(call)
          : responder;

      const send = () => {
        const payload =
          result.raw !== undefined
            ? result.raw
            : JSON.stringify(result.body ?? null);
        res.writeHead(result.status, {
          "Content-Type":
            result.raw !== undefined ? "text/plain" : "application/json",
          // Opt out of keep-alive: a pooled socket outlives the test and makes
          // jest warn about open handles after the run finishes.
          Connection: "close",
        });
        res.end(payload);
      };

      if (result.delayMs) setTimeout(send, result.delayMs);
      else send();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("mock-api: failed to bind an ephemeral port");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    when(method, path, responder) {
      routes.set(routeKey(method, path), responder);
    },
    calls(path) {
      return path ? recorded.filter((c) => c.path === path) : [...recorded];
    },
    reset() {
      routes.clear();
      recorded.length = 0;
    },
    stop() {
      // fetch keeps sockets alive, which would keep `close()` pending and leave
      // jest complaining about open handles.
      server.closeAllConnections?.();
      return new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    },
  };
}

/**
 * Point `@orbital/client` at the mock server.
 *
 * `onUnauthorized` is captured rather than triggering a real logout, so 401
 * handling can be asserted. No `refreshToken` is supplied, which makes
 * `customFetch` take its "no refresh callback" branch and surface the 401
 * immediately instead of retrying.
 */
export function useMockApiClient(mock: MockApi): { unauthorizedCalls: number } {
  const counter = { unauthorizedCalls: 0 };
  initializeApiClient({
    baseURL: mock.url,
    getToken: () => "test-token",
    onUnauthorized: () => {
      counter.unauthorizedCalls += 1;
    },
  });
  return counter;
}

/**
 * Registers the whole mock-API lifecycle for a suite: boot once, reset routes
 * and re-point the client before each test, shut down at the end.
 *
 * Call at `describe` scope:
 *   const api = withMockApi();
 *   it("…", () => { api().when("GET", "/tags", { status: 200, body: [] }); });
 */
export function withMockApi(): (() => MockApi) & {
  unauthorizedCalls: () => number;
} {
  let mock: MockApi;
  let counter = { unauthorizedCalls: 0 };

  beforeAll(async () => {
    mock = await startMockApi();
  });

  afterAll(async () => {
    await mock.stop();
  });

  beforeEach(() => {
    mock.reset();
    counter = useMockApiClient(mock);
  });

  const accessor = (() => mock) as (() => MockApi) & {
    unauthorizedCalls: () => number;
  };
  accessor.unauthorizedCalls = () => counter.unauthorizedCalls;
  return accessor;
}
