import { router, useLocalSearchParams } from "expo-router";
import { Screen, Status, IconButton } from "@/components/ui";
import { ArrowLeft } from "lucide-react-native";
import { useWorkoutDetail } from "./queries";
import { useCurrentUser } from "@/data/queries";
import { WorkoutVitals } from "./WorkoutVitals";

export default function WorkoutVitalsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useWorkoutDetail(id);
  const user = useCurrentUser();
  const providerLabel = detail.data?.healthWorkout.provider === "garmin_connect" ? "Garmin" : "Apple Watch";
  return (
    <Screen
      title="Workout details"
      subtitle={`${providerLabel} workout vitals`}
      leading={<IconButton label="Back" icon={ArrowLeft} onPress={() => router.back()} />}
    >
      <Status loading={detail.isPending} error={detail.error} retry={() => void detail.refetch()} />
      {detail.data && <WorkoutVitals workout={detail.data.healthWorkout} resolved={detail.data.resolved} isOwner={detail.data.isOwner} canEditPrivacy={detail.data.canEditPrivacy} age={detail.data.isOwner ? user.data?.age : null} />}
      {!detail.isPending && !detail.error && !detail.data && <Status empty="This workout is no longer available." />}
    </Screen>
  );
}
