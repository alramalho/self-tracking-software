export const GPT_56_LUNA_MODEL = "openai/gpt-5.6-luna";
export const DEFAULT_AI_GATEWAY_MODEL = GPT_56_LUNA_MODEL;

/**
 * Onboarding interview model. Overridable per environment with ONBOARDING_MODEL.
 */
export function onboardingModel(): string {
  return process.env.ONBOARDING_MODEL || GPT_56_LUNA_MODEL;
}

/**
 * Onboarding runs at the highest practical reasoning effort: the interview is a
 * semantic gate, so a cheap miss produces a wrong plan or an incoherent prompt.
 */
export function onboardingProviderOptions(): {
  openai: { reasoningEffort: "xhigh" };
} {
  return { openai: { reasoningEffort: "xhigh" } };
}
