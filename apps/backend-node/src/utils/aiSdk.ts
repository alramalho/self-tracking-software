import "../instrumentation";

import * as ai from "ai";
import { wrapAISDK } from "braintrust";

const wrappedAI = wrapAISDK(ai);

export const createGateway = wrappedAI.createGateway;
export const generateObject = wrappedAI.generateObject;
export const generateText = wrappedAI.generateText;
export const Output = wrappedAI.Output;
export const tool = wrappedAI.tool;
export const ToolLoopAgent = wrappedAI.ToolLoopAgent;

export type {
  LanguageModelUsage,
  ModelMessage,
  UserContent,
} from "ai";
