import type { OnboardingDraft, PlanDesign } from "@tsw/prisma/follow-through";
import type { ClassifyResponse } from "./types";

export function initialDesign(classified: ClassifyResponse, baseline: string, weeklyDefault: number): PlanDesign {
  return {
    orientation: classified.orientation,
    goalSpec: classified.goalSpec,
    baseline: { text: baseline, measurements: [] },
    activities: [classified.activity],
    availableDays: weeklyDefault,
    fixedDate: null,
    asked: [],
    options: [],
    selected: null,
    startDate: new Date().toISOString().slice(0, 10),
  };
}

/** Everything the interview machinery and the plan need once a route (or a weekly target) is chosen. */
export function designedFacts(design: PlanDesign) {
  const activity = design.activities[0];
  const route = design.options.find((o) => o.id === design.selected);
  const first = route?.sessions[0];
  const outcome = design.orientation === "OUTCOME";
  return {
    emoji: activity.emoji,
    activityTitle: activity.title,
    measure: activity.measure,
    frequency: route?.trainingDaysPerWeek ?? design.availableDays,
    commitment: "WEEKLY" as const,
    weekdays: [] as number[],
    time: null,
    targetDate: outcome ? (route?.finishingDate ?? null) : null,
    nextStep: first
      ? `${first.title}: ${first.quantity} ${activity.measure} on ${first.date}.`
      : `Log your next ${activity.title.toLowerCase()} session.`,
    recommendation: "coaching" as const,
    coachingRole: outcome ? ("training" as const) : ("consistency" as const),
    recommendationReason: "",
    wantsCoaching: true,
  };
}

export const designedDraftFields = (design: PlanDesign): Pick<OnboardingDraft, "design"> => ({ design });
