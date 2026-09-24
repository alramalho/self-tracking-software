import "../instrumentation";

import * as ai from "ai";
import { wrapAISDK } from "braintrust";

const wrappedAI = wrapAISDK(ai);

export const createGateway = wrappedAI.createGateway;
export const generateImage = wrappedAI.generateImage;
export const generateObject = wrappedAI.generateObject;
export const generateText = wrappedAI.generateText;
export const Output = wrappedAI.Output;
// Braintrust's SDK wrapper currently types these two exports against its
// pre-v7 tool signatures. Keep tracing for generation calls, but use the
// native SDK 7 definitions for tools and agents so zod/v4 schemas infer
// correctly.
export const tool = ai.tool as any;
export const ToolLoopAgent = ai.ToolLoopAgent;

export type ToolLoopAgentInstance = ai.ToolLoopAgent<never, any, any, never>;

export type {
  LanguageModelUsage,
  ModelMessage,
  UserContent,
} from "ai";
