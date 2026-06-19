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
export const GLM_52_MODEL = "zai/glm-5.2";
export const DEFAULT_COACH_AGENT_MODEL = KIMI_K26_MODEL;
// Autonomous/proactive coach uses a stronger model: it reliably attaches plan
// proposals (kimi often skips the tool). Latency is irrelevant off the cron, so
// the slower GLM is worth it here while interactive chat stays on the default.
export const DEFAULT_AUTONOMOUS_COACH_AGENT_MODEL = GLM_52_MODEL;
export const DEFAULT_COACH_AGENT_VISION_MODEL = "openai/gpt-4.1";

const DEFAULT_COACH_AGENT_FALLBACK_MODELS = [
  "openai/gpt-5.4-mini",
  "anthropic/claude-sonnet-4.6",
];

// Per-model gateway routing. Add a model + its preferred provider order here
// rather than introducing new constants/branches.
const COACH_MODEL_ROUTING: Record<string, { providerOrder: string[] }> = {
  [KIMI_K26_MODEL]: { providerOrder: ["baseten", "togetherai"] },
  [GLM_52_MODEL]: { providerOrder: ["baseten"] },
};

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
  const routing = COACH_MODEL_ROUTING[model];
  if (!routing) return undefined;

  return {
    order: routing.providerOrder,
    models: getCoachAgentFallbackModels(),
  };
}

// Model id for the autonomous/proactive coach path (env-overridable). Pass this
// to generateResponse({ model }); gateway routing is applied downstream.
export function resolveAutonomousCoachAgentModel(): string {
  return (
    process.env.AUTONOMOUS_COACH_AGENT_MODEL?.trim() ||
    DEFAULT_AUTONOMOUS_COACH_AGENT_MODEL
  );
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
