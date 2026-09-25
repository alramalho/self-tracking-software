import "../instrumentation";

import * as ai from "ai";
import { assertAiConsent } from "./aiConsent";

// Every call below first checks the signed-in person's AI consent
// (see utils/aiConsent.ts). Outside a request (cron jobs) it does nothing;
// jobs filter people themselves.
function withAiConsent<F extends (...args: any[]) => any>(fn: F): F {
  return ((...args: any[]) => {
    assertAiConsent();
    return fn(...args);
  }) as F;
}

export const createGateway = ai.createGateway;
export const generateImage = withAiConsent(ai.generateImage);
export const generateObject = withAiConsent(ai.generateObject);
export const generateText = withAiConsent(ai.generateText);
export const evaluate = withAiConsent(ai.experimental_evaluate);
export const Output = ai.Output;
// Loosely typed: some tool schemas don't match the SDK's zod typings yet.
export const tool = ai.tool as any;
export const ToolLoopAgent = class extends ai.ToolLoopAgent<any, any, any, any> {
  override generate(options: any) {
    assertAiConsent();
    return super.generate(options);
  }
  override stream(options: any) {
    assertAiConsent();
    return super.stream(options);
  }
} as typeof ai.ToolLoopAgent;

export type ToolLoopAgentInstance = ai.ToolLoopAgent<never, any, any, never>;

export type {
  LanguageModelUsage,
  ModelMessage,
  UserContent,
} from "ai";
