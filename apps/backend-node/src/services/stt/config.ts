import type { STTConfig } from "./types";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
// Whisper accepts the language to listen for and reports the one it heard.
// Parakeet (the previous default) only guesses, and misheard short clips.
const OPENROUTER_DEFAULT_MODEL = "openai/whisper-large-v3";
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
