import type { PlanDesign } from "@tsw/prisma/follow-through";
import { api } from "@/data/api";
import type { ClassifyResponse, OptionsResponse } from "./types";

export const classifyGoal = async (goal: string) =>
  (await api.post<ClassifyResponse>("/follow-through/onboarding/design/classify", { goal }, { timeout: 90000 })).data;

export const suggestBaseline = async (activity: { title: string; measure: string }) =>
  (
    await api.get<{ baseline: PlanDesign["baseline"] | null }>("/follow-through/onboarding/design/baseline", {
      params: { title: activity.title, measure: activity.measure },
    })
  ).data.baseline;

export const nextSubgoal = async (design: PlanDesign, goal: string, baseline: string) =>
  (
    await api.post<{ question: { kind: string; title: string; choices: string[] } | null }>(
      "/follow-through/onboarding/design/subgoal",
      {
        goal,
        orientation: design.orientation,
        goalSpec: design.goalSpec,
        activity: { title: design.activities[0].title, measure: design.activities[0].measure },
        baseline,
        asked: design.asked,
      },
      { timeout: 90000 },
    )
  ).data.question;

export const designRoutes = async (design: PlanDesign, goal: string, timezone: string) =>
  (
    await api.post<OptionsResponse>(
      "/follow-through/onboarding/design/options",
      {
        goal,
        goalSpec: design.goalSpec,
        baseline: design.baseline.text,
        activities: design.activities,
        preferredDays: design.preferredDays,
        fixedDate: design.fixedDate,
        asked: design.asked,
        timezone,
      },
      { timeout: 180000 },
    )
  ).data;
