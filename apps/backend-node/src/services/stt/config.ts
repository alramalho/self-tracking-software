import type { STTConfig } from "./types";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_DEFAULT_MODEL = "nvidia/parakeet-tdt-0.6b-v3";
const OPENAI_DEFAULT_MODEL = "whisper-1";

export function resolveSTTConfig(
  environment: NodeJS.ProcessEnv = process.env,
): STTConfig {
  if (environment.OPENROUTER_API_KEY) {
    return {
      apiKey: environment.OPENROUTER_API_KEY,
      baseURL: OPENROUTER_BASE_URL,
      model: environment.STT_MODEL || OPENROUTER_DEFAULT_MODEL,
      provider: "OpenRouter",
    };
  }

  return {
    apiKey: environment.OPENAI_API_KEY,
    model: environment.STT_MODEL || OPENAI_DEFAULT_MODEL,
    provider: "OpenAI",
  };
}
