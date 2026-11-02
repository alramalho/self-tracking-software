import "../instrumentation";

import { appendFile } from "node:fs/promises";
import * as ai from "ai";
import { assertAiConsent } from "./aiConsent";
import { logger } from "./logger";

// Every call below first checks the signed-in person's AI consent
// (see utils/aiConsent.ts). Outside a request (cron jobs) it does nothing;
// jobs filter people themselves.
function withAiConsent<F extends (...args: any[]) => any>(fn: F): F {
  return ((...args: any[]) => {
    assertAiConsent();
    return fn(...args);
  }) as F;
}

/**
 * One line per AI call with the Gateway's own cost (no price table to maintain), in the app log and,
 * when AI_USAGE_LOG is set, appended to that file (on the host, so it outlives redeploys).
 * Read it with: jq -s 'group_by(.model) | map({model: .[0].model, usd: (map(.costUsd) | add)})' ai-usage.jsonl
 */
function recordUsage(kind: string, options: any, result: any) {
  try {
    const steps: any[] = result?.steps?.length ? result.steps : [result];
    const cost = steps.reduce((sum, s) => sum + (Number(s?.providerMetadata?.gateway?.cost) || 0), 0);
    const usage = result?.totalUsage ?? result?.usage ?? {};
    const line = {
      at: new Date().toISOString(),
      kind,
      name: options?.schemaName ?? options?.experimental_telemetry?.functionId ?? null,
      model: options?.model?.modelId ?? (typeof options?.model === "string" ? options.model : null),
      costUsd: Math.round(cost * 1e6) / 1e6,
      inputTokens: usage.inputTokens ?? null,
      outputTokens: usage.outputTokens ?? null,
      steps: steps.length,
    };
    logger.info("ai_call", line);
    const file = process.env.AI_USAGE_LOG;
    if (file) void appendFile(file, `${JSON.stringify(line)}\n`).catch(() => {});
  } catch {
    // Usage logging never breaks the call.
  }
}

function withUsage<F extends (options: any) => Promise<any>>(kind: string, fn: F): F {
  return (async (options: any) => {
    const result = await fn(options);
    recordUsage(kind, options, result);
    return result;
  }) as F;
}

export const createGateway = ai.createGateway;
export const generateImage = withAiConsent(withUsage("generateImage", ai.generateImage));
export const generateObject = withAiConsent(withUsage("generateObject", ai.generateObject));
export const generateText = withAiConsent(withUsage("generateText", ai.generateText));
export const evaluate = withAiConsent(ai.experimental_evaluate);
export const Output = ai.Output;
// Loosely typed: some tool schemas don't match the SDK's zod typings yet.
export const tool = ai.tool as any;
export const ToolLoopAgent = class extends ai.ToolLoopAgent<any, any, any, any> {
  override async generate(options: any) {
    assertAiConsent();
    const result = await super.generate(options);
    recordUsage("agent.generate", { model: (this as any).settings?.model, ...options }, result);
    return result;
  }
  override stream(options: any) {
    assertAiConsent();
    const result = super.stream(options);
    // The totals arrive when the stream ends.
    void Promise.resolve(result)
      .then(async (r: any) => recordUsage("agent.stream", { model: (this as any).settings?.model, ...options }, { steps: await r.steps, totalUsage: await r.totalUsage }))
      .catch(() => {});
    return result;
  }
} as typeof ai.ToolLoopAgent;

export type ToolLoopAgentInstance = ai.ToolLoopAgent<never, any, any, never>;

export type {
  LanguageModelUsage,
  ModelMessage,
  UserContent,
} from "ai";
