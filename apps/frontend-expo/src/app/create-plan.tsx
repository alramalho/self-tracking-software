import { useLocalSearchParams } from "expo-router";
import Onboarding from "@/features/onboarding/Onboarding";

export default function CreatePlanRoute() {
  const { voiceGoal } = useLocalSearchParams<{
    voiceGoal?: string | string[];
  }>();
  const initialGoal = Array.isArray(voiceGoal) ? voiceGoal[0] : voiceGoal;
  return <Onboarding initialGoal={initialGoal} />;
}
