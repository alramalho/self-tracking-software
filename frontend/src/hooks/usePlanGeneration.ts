import { useApiWithAuth } from "@/api";
import { Activity, ApiPlan } from "@/contexts/UserPlanContext";

interface PlanGenerationConfig {
  goal: string;
  finishingDate?: string;
  activities: Activity[];
  description?: string;
  isEdit?: boolean;
}

export function usePlanGeneration() {
  const api = useApiWithAuth();

  const generateSessions = async (
    config: PlanGenerationConfig
  ): Promise<ApiPlan["sessions"]> => {
    const response = await api.post("/generate-sessions", {
      goal: config.goal,
      finishing_date: config.finishingDate,
      activities: config.activities,
      description: config.description,
      is_edit: config.isEdit,
    });

    return response.data.sessions;
  };

  return { generateSessions };
}
