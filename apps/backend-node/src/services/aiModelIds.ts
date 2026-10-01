export const GPT_56_LUNA_MODEL = "openai/gpt-5.6-luna";
export const GPT_6_LUNA_MODEL = "openai/gpt-6-luna";
export const DEEPSEEK_V4_1_FLASH_MODEL = "deepseek/deepseek-v4.1-flash";
export const DEFAULT_AI_GATEWAY_MODEL = GPT_56_LUNA_MODEL;

export type OnboardingProvider = "gateway" | "openrouter";

export function onboardingProvider(): OnboardingProvider {
  return process.env.ONBOARDING_PROVIDER === "openrouter"
    ? "openrouter"
    : "gateway";
}

/**
 * Onboarding interview model. Overridable per environment with ONBOARDING_MODEL.
 */
export function onboardingModel(): string {
  return (
    process.env.ONBOARDING_MODEL ||
    (onboardingProvider() === "openrouter"
      ? process.env.OPENROUTER_MODEL || GPT_56_LUNA_MODEL
      : DEEPSEEK_V4_1_FLASH_MODEL)
  );
}

/** Fast validation used while the user is still composing the goal. */
export function onboardingValidationModel(): string {
  return process.env.ONBOARDING_VALIDATION_MODEL || DEEPSEEK_V4_1_FLASH_MODEL;
}

/**
 * Onboarding runs at the highest practical reasoning effort: the interview is a
 * semantic gate, so a cheap miss produces a wrong plan or an incoherent prompt.
 */
export function onboardingProviderOptions(): Record<
  string,
  Record<string, unknown>
> {
  return onboardingProvider() === "openrouter" ||
    !onboardingModel().startsWith("openai/")
    ? {}
    : { openai: { reasoningEffort: "xhigh" } };
}

export function onboardingValidationProviderOptions(): Record<
  string,
  Record<string, unknown>
> {
  return onboardingProvider() === "openrouter" ||
    !onboardingValidationModel().startsWith("openai/")
    ? {}
    : { openai: { reasoningEffort: "low" } };
}

export const CLAUDE_SONNET_5_5_MODEL = "anthropic/claude-sonnet-5.5";

/**
 * Plan design uses a different model per job, chosen from the live benchmark (Oct 2026):
 * - quick: reading the goal, the target question, the coach's check of the days. Short, cheap calls.
 * - design: the two routes at onboarding. Once per person, the first impression: Sonnet 5.5 built
 *   better-progressing, more distinct routes and passed every rule first time (~$0.09 a plan).
 * - adapt: the next two weeks, every couple of weeks. gpt-6-luna was as good as Sonnet here (~$0.001).
 * - fallback: when a plan fails the checks twice, try once more on a stronger model before showing an error.
 * Each can be overridden: PLAN_QUICK_MODEL, PLAN_DESIGN_MODEL, PLAN_ADAPT_MODEL, PLAN_FALLBACK_MODEL ("none" disables).
 */
export type PlanModelRole = "quick" | "design" | "adapt" | "fallback";
export function planModel(role: PlanModelRole): string | null {
  const env = {
    quick: process.env.PLAN_QUICK_MODEL,
    design: process.env.PLAN_DESIGN_MODEL,
    adapt: process.env.PLAN_ADAPT_MODEL,
    fallback: process.env.PLAN_FALLBACK_MODEL,
  }[role];
  if (env === "none") return null;
  return env || { quick: GPT_6_LUNA_MODEL, design: CLAUDE_SONNET_5_5_MODEL, adapt: GPT_6_LUNA_MODEL, fallback: CLAUDE_SONNET_5_5_MODEL }[role];
}

/**
 * Reasoning effort per model. gpt-6-luna at low passed the checks at ~20 s where medium was slower and less
 * reliable; Claude at medium (its default on Opus 5.5). The validator, not extra thinking, keeps the numbers
 * honest. PLAN_DESIGN_EFFORT overrides for everything.
 */
export function effortFor(model: string): "low" | "medium" | "high" {
  const value = process.env.PLAN_DESIGN_EFFORT;
  if (value === "low" || value === "medium" || value === "high") return value;
  return model.startsWith("anthropic/") ? "medium" : "low";
}
