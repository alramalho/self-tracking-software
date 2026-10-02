export function independentTrackingStep(
  activityTitle: string,
  nextStep: string,
) {
  if (nextStep.trim() && !/\bcoach(?:es|ing)?\b/i.test(nextStep))
    return nextStep;
  return `Log your next ${activityTitle.trim().toLowerCase()} session.`;
}
