export const GPT_56_LUNA_MODEL = "openai/gpt-5.6-luna";
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
