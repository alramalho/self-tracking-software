import { useApiWithAuth } from "@/api";
import { Activity, GeneratedPlan } from "@/contexts/UserPlanContext";

interface PlanGenerationConfig {
  goal: string;
  finishingDate?: string;
  activities: Activity[];
  onlyTheseActivities: boolean;
  description: string;
  isEdit?: boolean;
}

export const usePlanGeneration = () => {
  const api = useApiWithAuth();

  const generatePlan = async (
    config: PlanGenerationConfig
  ): Promise<GeneratedPlan> => {
    const selectedActivitiesText =
      config.activities.length > 0
        ? `Please ${
            config.onlyTheseActivities
              ? "only include"
              : "include (but not only)"
          } these activities in plan:\n${config.activities
            .map(
              (activity) =>
                `- "${activity.title}" measured in "${activity.measure}"`
            )
            .join("\n")}\n\n`
        : "";

    const descriptionPrefix = config.isEdit
      ? `\nThis is an edit to the existing plan with goal: "${config.goal}". \n\n`
      : "";

    const fullDescription = `${descriptionPrefix}${selectedActivitiesText}${
      config.description
        ? `The user provided the additional description which you should solemly take into account over any other considerations or progressiveness: "${config.description}"`
        : ""
    }`;

    const response = await api.post("/generate-plans", {
      goal: config.goal,
      finishingDate: config.finishingDate,
      planDescription: fullDescription,
    });

    if (!response.data.plans?.[0]) {
      throw new Error("No plan generated");
    }

    return response.data.plans[0];
  };

  return { generatePlan };
};
