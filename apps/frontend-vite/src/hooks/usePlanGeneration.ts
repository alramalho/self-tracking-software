import { useApiWithAuth } from "@/api";
import { type CompletePlan } from "@/contexts/plans";
import { type Activity } from "@tsw/prisma";

interface PlanGenerationConfig {
  goal: string;
  finishingDate?: Date;
  activities: Activity[];
  description?: string;
  existingPlan?: CompletePlan;
}

export function usePlanGeneration() {
  const api = useApiWithAuth();

  const generateSessions = async (
    config: PlanGenerationConfig
  ): Promise<
    Array<{
      date: Date;
      activityId: any;
      descriptive_guide: string;
      quantity: number;
    }>
  > => {
    const response = await api.post("/plans/generate-sessions", {
      goal: config.goal,
      finishingDate: config.finishingDate,
      activities: config.activities,
      description: config.description,
      existing_plan: config.existingPlan,
    });

    return response.data.sessions;
  };

  return { generateSessions };
}
