import type { STTConfig } from "./types";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
// gpt-4o-transcribe: on 12 Nov 2026 it got a Portuguese clip right in 0.8 s where Whisper large-v3 took 6 s,
// and Better Groceries measured it at 93% of real voice notes vs ~70% for older models.
// It takes the language(s) as a prompt but doesn't report the one it heard.
const OPENROUTER_DEFAULT_MODEL = "openai/gpt-4o-transcribe";
const OPENAI_DEFAULT_MODEL = "gpt-4o-transcribe";
// Segment timestamps only come from Whisper.
const OPENROUTER_TIMESTAMP_MODEL = "openai/whisper-large-v3";
const OPENAI_TIMESTAMP_MODEL = "whisper-1";

export function resolveSTTConfig(
  environment: NodeJS.ProcessEnv = process.env,
): STTConfig {
  if (environment.OPENROUTER_API_KEY) {
    return {
      apiKey: environment.OPENROUTER_API_KEY,
      baseURL: OPENROUTER_BASE_URL,
      model: environment.STT_MODEL || OPENROUTER_DEFAULT_MODEL,
      timestampModel: OPENROUTER_TIMESTAMP_MODEL,
      provider: "OpenRouter",
    };
  }

  return {
    apiKey: environment.OPENAI_API_KEY,
    model: environment.STT_MODEL || OPENAI_DEFAULT_MODEL,
    timestampModel: OPENAI_TIMESTAMP_MODEL,
    provider: "OpenAI",
  };
}
