import { useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Screen, IconButton, Status } from "@/components/ui";
import { goBack } from "@/core/navigation";
import { usePlan } from "@/data/queries";
import { SupportEditor } from "@/features/follow-through/SupportEditor";
export default function PlanSupport() {
  const { id, tools } = useLocalSearchParams<{ id: string; tools?: string }>();
  const plan = usePlan(id);
  return (
    <Screen
      title={plan.data?.goal || "Plan assistance"}
      leading={<IconButton label="Back" icon={ArrowLeft} onPress={goBack} />}
    >
      <Status loading={plan.isLoading} error={plan.error} />
      {plan.data && (
        <SupportEditor plan={plan.data} toolsOnly={tools === "1"} />
      )}
    </Screen>
  );
}
