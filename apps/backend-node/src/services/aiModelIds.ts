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
export const CLAUDE_OPUS_5_5_MODEL = "anthropic/claude-opus-5.5";

/**
 * Plan design uses a different model per job, chosen from the live benchmarks (Oct 2026):
 * - quick: reading the goal, the target question, the coach's check of the days. Short, cheap calls (gpt-6-luna).
 * - design: the two routes at onboarding, once per person. Opus 5.5 wrote the most expert plans
 *   (warm-up sets, progression gated on reps in reserve, distinct heavy/volume days) for ~$0.17 a plan.
 * - adapt: the next two weeks, every couple of weeks, in the background. With the load rules enforced in code
 *   (validate.ts loadChangeProblems), Sonnet 5.5 made the same decisions as Opus for ~$0.03 instead of ~$0.07.
 * - fallback: when a plan fails the checks twice, the other Claude model tries before the person sees an error.
 * Overrides: PLAN_QUICK_MODEL, PLAN_DESIGN_MODEL, PLAN_ADAPT_MODEL, PLAN_FALLBACK_MODEL ("none" disables).
 */
export type PlanModelRole = "quick" | "design" | "adapt";
export function planModel(role: PlanModelRole): string {
  const env = { quick: process.env.PLAN_QUICK_MODEL, design: process.env.PLAN_DESIGN_MODEL, adapt: process.env.PLAN_ADAPT_MODEL }[role];
  return env || { quick: GPT_6_LUNA_MODEL, design: CLAUDE_OPUS_5_5_MODEL, adapt: CLAUDE_SONNET_5_5_MODEL }[role];
}
export function fallbackModel(primary: string): string | null {
  const env = process.env.PLAN_FALLBACK_MODEL;
  if (env === "none") return null;
  const fallback = env || (primary === CLAUDE_OPUS_5_5_MODEL ? CLAUDE_SONNET_5_5_MODEL : CLAUDE_OPUS_5_5_MODEL);
  return fallback === primary ? null : fallback;
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
