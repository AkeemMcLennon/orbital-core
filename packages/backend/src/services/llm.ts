import { AxAI } from "@ax-llm/ax";
import { ORPCError } from "@orpc/server";
import { settings } from "../config";

let ai: AxAI | null = null;
let visionAi: AxAI | null = null;

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
      message: "Vision model not configured. Set LLM_VISION_MODEL or LLM_FAST_MODEL.",
    });
  }

  if (!visionAi) {
    visionAi = new AxAI({
      name: "openai",
      apiKey: settings.LLM_API_KEY,
      apiURL: settings.LLM_BASE_URL,
      config: { model: model as any },
    });
  }

  return visionAi;
}

export function resetLLMClient(): void {
  ai = null;
  visionAi = null;
}
