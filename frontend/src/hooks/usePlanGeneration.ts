import { useApiWithAuth } from "@/api";
import { Activity, GeneratedPlan } from "@/contexts/UserPlanContext";

interface PlanGenerationConfig {
  goal: string;
  finishingDate?: string;
  activities: Activity[];
  description: string;
  isEdit?: boolean;
}

export const usePlanGeneration = () => {
  const api = useApiWithAuth();

  const generatePlan = async (
    config: PlanGenerationConfig
  ): Promise<GeneratedPlan> => {
    const descriptionPrefix = config.isEdit
      ? `\nThis is an edit to the existing plan with goal: "${config.goal}". \n\n`
      : "";

    const fullDescription = `${descriptionPrefix}${
      config.description
        ? `The user provided the additional description which you should solemly take into account over any other considerations or progressiveness: "${config.description}"`
        : ""
    }`;

    const response = await api.post("/generate-plans", {
      goal: config.goal,
      finishingDate: config.finishingDate,
      planDescription: fullDescription,
      userDefinedActivities: config.activities,
    });

    if (!response.data.plans?.[0]) {
      throw new Error("No plan generated");
    }

    return response.data.plans[0];
  };

  return { generatePlan };
};
