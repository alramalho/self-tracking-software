import { describe, expect, it } from "vitest";
import { resolveSTTConfig } from "./config";

describe("resolveSTTConfig", () => {
  it("uses gpt-4o-transcribe through OpenRouter when its key is available", () => {
    expect(resolveSTTConfig({ OPENROUTER_API_KEY: "configured" })).toEqual({
      apiKey: "configured",
      baseURL: "https://openrouter.ai/api/v1",
      model: "openai/gpt-4o-transcribe",
      timestampModel: "openai/whisper-large-v3",
      coverageModel: "openai/whisper-large-v3",
      provider: "OpenRouter",
    });
  });

  it("keeps the direct OpenAI fallback for local environments", () => {
    expect(resolveSTTConfig({ OPENAI_API_KEY: "configured" })).toEqual({
      apiKey: "configured",
      model: "gpt-4o-transcribe",
      timestampModel: "whisper-1",
      coverageModel: "whisper-1",
      provider: "OpenAI",
    });
  });

  it("respects an explicit speech-to-text model", () => {
    expect(
      resolveSTTConfig({
        OPENROUTER_API_KEY: "configured",
        STT_MODEL: "nvidia/parakeet-tdt-0.6b-v3",
      }).model,
    ).toBe("nvidia/parakeet-tdt-0.6b-v3");
  });

  it("runs no Whisper check when it is turned off or already the main model", () => {
    expect(resolveSTTConfig({ OPENROUTER_API_KEY: "k", STT_COVERAGE_CHECK: "off" }).coverageModel).toBeUndefined();
    expect(
      resolveSTTConfig({ OPENROUTER_API_KEY: "k", STT_MODEL: "openai/whisper-large-v3" }).coverageModel,
    ).toBeUndefined();
  });
});
