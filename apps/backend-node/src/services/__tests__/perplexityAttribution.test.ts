import { beforeEach, describe, expect, it, vi } from "vitest";

const perplexityConstructor = vi.fn();

vi.mock("@perplexity-ai/perplexity_ai", () => ({
  default: class {
    search = { create: vi.fn() };
    constructor(options: unknown) {
      perplexityConstructor(options);
    }
  },
}));

describe("Perplexity client attribution", () => {
  beforeEach(() => {
    vi.resetModules();
    perplexityConstructor.mockClear();
    vi.stubEnv("PERPLEXITY_API_KEY", "test-key");
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-gateway-key");
  });

  it.each([
    ["webSearchService", () => import("../webSearchService")],
    ["perplexityAiService", () => import("../perplexityAiService")],
  ])("%s sends the X-Pplx-Integration header", async (_name, load) => {
    await load();

    expect(perplexityConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "test-key",
        defaultHeaders: { "X-Pplx-Integration": "self-tracking-software" },
      }),
    );
  });
});
