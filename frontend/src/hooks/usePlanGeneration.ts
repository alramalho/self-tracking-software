import { useApiWithAuth } from "@/api";
import { CompletePlan } from "@/contexts/UserGlobalContext";
import { HydratedCurrentUser } from "@/zero/queries";

interface PlanGenerationConfig {
  goal: string;
  finishingDate?: Date;
  activities: HydratedCurrentUser["activities"];
  description?: string;
  existingPlan?: HydratedCurrentUser["plans"][number];
}

export function usePlanGeneration() {
  const api = useApiWithAuth();

  const generateSessions = async (
    config: PlanGenerationConfig
  ): Promise<CompletePlan["sessions"]> => {
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
