import { gateway } from "@ai-sdk/gateway";
import { jsonSchema } from "ai";
import { z } from "zod/v4";
import { generateObject } from "../../utils/aiSdk";
import { planDesignModel } from "../aiModelIds";
import type { ObjectGenerator } from "./types";

/** The real model call. Reasoning effort goes through provider options, keyed by the real provider name. */
export const gatewayGenerator: ObjectGenerator = async ({ name, schema, system, prompt, effort }) => {
  const model = planDesignModel();
  const result = await generateObject({
    model: gateway(model),
    schema: jsonSchema(z.toJSONSchema(schema) as never),
    schemaName: name,
    system,
    prompt,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(170_000),
    // Effort goes under the real provider's key; the Gateway forwards it.
    providerOptions: model.startsWith("openai/")
      ? { openai: { reasoningEffort: effort } }
      : model.startsWith("anthropic/")
        ? { anthropic: { effort } }
        : {},
  });
  const cost = (result.providerMetadata?.gateway as { cost?: string } | undefined)?.cost;
  return {
    object: schema.parse(result.object),
    usage: {
      model,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      reasoningTokens: result.usage.outputTokenDetails?.reasoningTokens ?? 0,
      ...(cost ? { costUsd: Number(cost) } : {}),
    },
  };
};
