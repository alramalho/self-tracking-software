import type { GatewayProviderOptions } from "@ai-sdk/gateway";
import type { User } from "@tsw/prisma";

/** Gateway routing (order / only) paired with a model id — see Vercel AI Gateway provider options. */
export type CoachAgentGatewayRouting = Pick<
  GatewayProviderOptions,
  "only" | "order" | "models"
>;

export type CoachAgentModelConfig = {
  model: string;
  gateway?: CoachAgentGatewayRouting;
};

export const KIMI_K26_MODEL = "moonshotai/kimi-k2.6";
export const DEFAULT_COACH_AGENT_MODEL = KIMI_K26_MODEL;
export const DEFAULT_COACH_AGENT_VISION_MODEL = "openai/gpt-4.1";
const KIMI_K26_PROVIDER_ORDER = [
  "baseten",
  "togetherai"
];
const DEFAULT_COACH_AGENT_FALLBACK_MODELS = [
  "openai/gpt-5.4-mini",
  "anthropic/claude-sonnet-4.6",
];

function getCoachAgentFallbackModels(): string[] {
  const configuredModels = process.env.COACH_AGENT_FALLBACK_MODELS
    ?.split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  return configuredModels && configuredModels.length > 0
    ? configuredModels
    : DEFAULT_COACH_AGENT_FALLBACK_MODELS;
}

function getGatewayRoutingForModel(
  model: string
): CoachAgentGatewayRouting | undefined {
  if (model === KIMI_K26_MODEL) {
    return {
      order: KIMI_K26_PROVIDER_ORDER,
      models: getCoachAgentFallbackModels(),
    };
  }

  return undefined;
}

export function resolveCoachAgentModelConfig(
  modelOverride?: string
): CoachAgentModelConfig {
  const model =
    modelOverride?.trim() ||
    process.env.COACH_AGENT_MODEL?.trim() ||
    DEFAULT_COACH_AGENT_MODEL;

  const gateway = getGatewayRoutingForModel(model);

  return gateway ? { model, gateway } : { model };
}

export function resolveCoachAgentVisionModelConfig(
  modelOverride?: string
): CoachAgentModelConfig {
  const model =
    modelOverride?.trim() ||
    process.env.COACH_AGENT_VISION_MODEL?.trim() ||
    DEFAULT_COACH_AGENT_VISION_MODEL;

  const gateway = getGatewayRoutingForModel(model);

  return gateway ? { model, gateway } : { model };
}

export function buildCoachAgentProviderOptions(
  user: User,
  config: CoachAgentModelConfig
) {
  const tags = ["coach-agent"];
  if (process.env.NODE_ENV) {
    tags.push(`env:${process.env.NODE_ENV}`);
  }

  return {
    gateway: {
      ...config.gateway,
      user: user.id,
      tags,
    },
  };
}
