import { serve } from "bun";

export interface ChatMessage {
  role: string;
  content: unknown;
}

export interface ChatRequest {
  model?: string;
  stream?: boolean;
  messages: ChatMessage[];
  [key: string]: unknown;
}

export type MockLLMHandler = (body: ChatRequest) => string | { status: number };

export interface MockLLMServer {
  /** Pass as LLM_BASE_URL in envOverrides */
  url: string;
  /** Captured request bodies, in order received */
  requests: ChatRequest[];
  /** Return this raw completion content for all subsequent requests */
  setContent(content: string): void;
  /** Route per-request (e.g. by inspecting the rendered prompt) */
  setHandler(fn: MockLLMHandler): void;
  /**
   * Respond with an HTTP error. Defaults to 400 — ax retries
   * 408/429/5xx with ~7s of backoff, which would stall tests.
   */
  setError(status?: number): void;
  /** Clear handler and captured requests */
  reset(): void;
  stop(): void;
}

// Unparseable as any required output field — AxGen throws, services
// catch and swallow, so unconfigured calls fail softly.
const DEFAULT_CONTENT = "";

function completionBody(content: string, model: string) {
  return {
    id: "chatcmpl-mock",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
}

function streamingResponse(content: string, model: string): Response {
  const created = Math.floor(Date.now() / 1000);
  const chunk = (delta: Record<string, unknown>, finish: string | null) =>
    `data: ${JSON.stringify({
      id: "chatcmpl-mock",
      object: "chat.completion.chunk",
      created,
      model,
      choices: [{ index: 0, delta, finish_reason: finish }],
    })}\n\n`;
  const body =
    chunk({ role: "assistant", content }, null) +
    chunk({}, "stop") +
    "data: [DONE]\n\n";
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}

export async function startMockLLMServer(): Promise<MockLLMServer> {
  let handler: MockLLMHandler | null = null;
  const requests: ChatRequest[] = [];

  const server = serve({
    port: 0,
    fetch: async (req) => {
      const url = new URL(req.url);

      if (url.pathname === "/health") {
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (req.method === "POST" && url.pathname.endsWith("/chat/completions")) {
        const body = (await req.json()) as ChatRequest;
        requests.push(body);

        const result = handler ? handler(body) : DEFAULT_CONTENT;
        if (typeof result === "object") {
          return new Response(
            JSON.stringify({ error: { message: "mock LLM error" } }),
            {
              status: result.status,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const model = body.model ?? "mock-model";
        if (body.stream) {
          return streamingResponse(result, model);
        }
        return new Response(JSON.stringify(completionBody(result, model)), {
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  const url = `http://localhost:${server.port}`;
  await waitForServer(`${url}/health`);

  return {
    url,
    requests,
    setContent(content) {
      handler = () => content;
    },
    setHandler(fn) {
      handler = fn;
    },
    setError(status = 400) {
      handler = () => ({ status });
    },
    reset() {
      handler = null;
      requests.length = 0;
    },
    stop() {
      server.stop();
    },
  };
}

/**
 * Render fields in AxGen's completion grammar so gen.forward() parses them.
 * axFieldContent({ tags: ["A", "B"] }) → 'Tags: ["A", "B"]'
 * Field names convert to section titles the same way AxGen does
 * (jobTitle → "Job Title").
 */
export function axFieldContent(fields: Record<string, unknown>): string {
  return Object.entries(fields)
    .map(([name, value]) => {
      const rendered =
        value !== null && typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
      return `${fieldTitle(name)}: ${rendered}`;
    })
    .join("\n");
}

function fieldTitle(name: string): string {
  let t = name.replace(/_/g, " ");
  t = t.replace(/([A-Z]|[0-9]+)/g, " $1").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

async function waitForServer(url: string, maxAttempts = 10): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server not ready at ${url} after ${maxAttempts} attempts`);
}
