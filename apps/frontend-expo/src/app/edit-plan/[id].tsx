import { useLocalSearchParams } from "expo-router";
import { usePlan } from "@/data/queries";
import { PlanEditor } from "@/features/plans/PlanEditor";
import { Screen, Status } from "@/components/ui";
export default function EditPlan() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const plan = usePlan(id);
  return plan.data ? (
    <PlanEditor plan={plan.data} />
  ) : (
    <Screen>
      <Status
        loading={plan.isPending}
        error={plan.error}
        retry={() => void plan.refetch()}
      />
    </Screen>
  );
}
