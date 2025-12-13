import { useApiWithAuth } from "@/api";
import { type CompletePlan } from "@/contexts/plans";
import { type Activity } from "@tsw/prisma";

interface PlanGenerationConfig {
  goal: string;
  finishingDate?: Date;
  activities: Activity[];
  description?: string;
  existingPlan?: CompletePlan;
  // New parameters for research-based pipeline
  experience?: string;
  timesPerWeek?: number;
}

interface GeneratedSession {
  date: Date;
  activityId: any;
  descriptive_guide: string;
  quantity: number;
  imageUrl?: string;
}

interface GenerateSessionsResult {
  sessions: GeneratedSession[];
  researchFindings?: string;
  coachPrompt?: string;
}

export function usePlanGeneration() {
  const api = useApiWithAuth();

  const generateSessions = async (
    config: PlanGenerationConfig
  ): Promise<GeneratedSession[]> => {
    const response = await api.post("/plans/generate-sessions", {
      goal: config.goal,
      finishingDate: config.finishingDate,
      activities: config.activities,
      description: config.description,
      existing_plan: config.existingPlan,
      // New parameters for the 3-stage pipeline
      experience: config.experience,
      timesPerWeek: config.timesPerWeek,
    });

    return response.data.sessions;
  };

  const generateSessionsWithMetadata = async (
    config: PlanGenerationConfig
  ): Promise<GenerateSessionsResult> => {
    const response = await api.post("/plans/generate-sessions", {
      goal: config.goal,
      finishingDate: config.finishingDate,
      activities: config.activities,
      description: config.description,
      existing_plan: config.existingPlan,
      experience: config.experience,
      timesPerWeek: config.timesPerWeek,
    });

    return {
      sessions: response.data.sessions,
      researchFindings: response.data.researchFindings,
      coachPrompt: response.data.coachPrompt,
    };
  };

  return { generateSessions, generateSessionsWithMetadata };
}
