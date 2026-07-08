import { AxAI } from "@ax-llm/ax";
import { ORPCError } from "@orpc/server";
import { settings } from "../config";

let ai: AxAI | null = null;
let visionAi: AxAI | null = null;

/**
 * Ax's "openai" provider always sends `image_url.details` (defaulting to
 * "auto"), which OpenAI tolerates but Cerebras' strict request validation
 * rejects outright ("property ... is unsupported"). Ax's `chatReqUpdater`
 * hook exists for exactly this kind of per-provider request tweak, but the
 * "openai" provider implementation doesn't wire it through — so we intercept
 * at the HTTP layer instead via the `fetch` override it does forward.
 */
const stripImageDetailsFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  if (typeof init?.body === "string" && init.body.includes('"image_url"')) {
    const body = JSON.parse(init.body);
    for (const msg of body.messages ?? []) {
      if (!Array.isArray(msg.content)) continue;
      for (const part of msg.content) {
        if (part.type === "image_url" && part.image_url) {
          delete part.image_url.details;
        }
      }
    }
    init = { ...init, body: JSON.stringify(body) };
  }
  return fetch(input, init);
};

export function getAI(): AxAI {
  if (!settings.LLM_BASE_URL || !settings.LLM_API_KEY) {
    throw new ORPCError("BAD_REQUEST", {
      message: "LLM service not configured. Set LLM_BASE_URL and LLM_API_KEY.",
    });
  }
  if (!settings.LLM_FAST_MODEL) {
    throw new ORPCError("BAD_REQUEST", {
      message: "LLM model not configured. Set LLM_FAST_MODEL.",
    });
  }

  if (!ai) {
    ai = new AxAI({
      name: "openai",
      apiKey: settings.LLM_API_KEY,
      apiURL: settings.LLM_BASE_URL,
      config: { model: settings.LLM_FAST_MODEL as any },
    });
  }

  return ai;
}

export function getVisionAI(): AxAI {
  if (!settings.LLM_BASE_URL || !settings.LLM_API_KEY) {
    throw new ORPCError("BAD_REQUEST", {
      message: "LLM service not configured. Set LLM_BASE_URL and LLM_API_KEY.",
    });
  }
  const model = settings.LLM_VISION_MODEL ?? settings.LLM_FAST_MODEL;
  if (!model) {
    throw new ORPCError("BAD_REQUEST", {
      message:
        "Vision model not configured. Set LLM_VISION_MODEL or LLM_FAST_MODEL.",
    });
  }

  if (!visionAi) {
    visionAi = new AxAI({
      name: "openai",
      apiKey: settings.LLM_API_KEY,
      apiURL: settings.LLM_BASE_URL,
      config: { model: model as any },
      options: { fetch: stripImageDetailsFetch as typeof fetch },
    });
  }

  return visionAi;
}

export function resetLLMClient(): void {
  ai = null;
  visionAi = null;
}
