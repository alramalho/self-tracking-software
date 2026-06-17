import type { Activity, Plan, PlanSession } from "@tsw/prisma";

export type OnboardingCompletionPlan = Plan & {
  activities: Activity[];
  sessions: Array<PlanSession & { activity: Activity }>;
};
