import { useLocalSearchParams } from "expo-router";
import { RedesignPlan } from "@/features/plans/redesign/RedesignPlan";

export default function RedesignPlanRoute() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  return <RedesignPlan planId={String(planId)} />;
}
