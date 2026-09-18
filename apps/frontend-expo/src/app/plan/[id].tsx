import { View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { IconButton } from "@/features/messages/IconButton";
import { useColors } from "@/components/ui";
import { goBack } from "@/core/navigation";
import { useLocalSearchParams } from "expo-router";
import {
  useCurrentUser,
  usePlan,
  useEntries,
  useProfile,
} from "@/data/queries";
import { PlanCard } from "@/features/plans/PlanCard";
import { Screen, Status, Heading } from "@/components/ui";
export default function PlanPage() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const plan = usePlan(id);
  const user = useCurrentUser();
  const own = !!plan.data && plan.data.userId === user.data?.id;
  const entries = useEntries(own);
  const owner = useProfile(undefined, !own ? plan.data?.userId : undefined);
  return (
    <Screen testID={`plan-detail-${id}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton label="Back" onPress={goBack}>
          <ArrowLeft size={20} color={c.text} />
        </IconButton>
        <Heading>Plans</Heading>
      </View>
      <Status
        loading={plan.isPending}
        error={plan.error}
        retry={() => void plan.refetch()}
      />
      {plan.data && (
        <PlanCard
          plan={plan.data}
          entries={(own ? entries.data : owner.data?.activityEntries) ?? []}
          own={own}
          detail
          premium={user.data?.planType !== "FREE"}
        />
      )}
    </Screen>
  );
}
