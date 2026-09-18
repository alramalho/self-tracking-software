import { describe, expect, it } from "vitest";
import { resolveSTTConfig } from "./config";

describe("resolveSTTConfig", () => {
  it("uses NVIDIA Parakeet through OpenRouter when its key is available", () => {
    expect(resolveSTTConfig({ OPENROUTER_API_KEY: "configured" })).toEqual({
      apiKey: "configured",
      baseURL: "https://openrouter.ai/api/v1",
      model: "nvidia/parakeet-tdt-0.6b-v3",
      provider: "OpenRouter",
    });
  });

  it("keeps the direct OpenAI fallback for local environments", () => {
    expect(resolveSTTConfig({ OPENAI_API_KEY: "configured" })).toEqual({
      apiKey: "configured",
      model: "whisper-1",
      provider: "OpenAI",
    });
  });

  it("respects an explicit speech-to-text model", () => {
    expect(
      resolveSTTConfig({
        OPENROUTER_API_KEY: "configured",
        STT_MODEL: "openai/whisper-large-v3",
      }).model,
    ).toBe("openai/whisper-large-v3");
  });
});
