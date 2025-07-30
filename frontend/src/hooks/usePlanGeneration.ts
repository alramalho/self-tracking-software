import { useApiWithAuth } from "@/api";
import { Activity, ApiPlan } from "@/contexts/UserPlanContext";

interface PlanGenerationConfig {
  goal: string;
  finishingDate?: string;
  activities: Activity[];
  description?: string;
  existingPlan?: ApiPlan;
}

export function usePlanGeneration() {
  const api = useApiWithAuth();

  const generateSessions = async (
    config: PlanGenerationConfig
  ): Promise<ApiPlan["sessions"]> => {
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
