import { router, useLocalSearchParams } from "expo-router";
import { Screen, Status, IconButton } from "@/components/ui";
import { ArrowLeft } from "lucide-react-native";
import { useHealthWorkouts } from "./queries";
import { useCurrentUser } from "@/data/queries";
import { WorkoutVitals } from "./WorkoutVitals";

export default function WorkoutVitalsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workouts = useHealthWorkouts();
  const user = useCurrentUser();
  const item = workouts.data?.items.find((candidate) => candidate.healthWorkout.id === id);
  return (
    <Screen
      title="Workout details"
      subtitle={item?.healthWorkout.provider === "garmin" ? "Your Garmin vitals" : "Your Apple Watch vitals"}
      leading={<IconButton label="Back" icon={ArrowLeft} onPress={() => router.back()} />}
    >
      <Status loading={workouts.isPending} error={workouts.error} retry={() => void workouts.refetch()} />
      {item && <WorkoutVitals workout={item.healthWorkout} resolved={item.resolved} age={user.data?.age} />}
      {!workouts.isPending && !item && <Status empty="This workout is no longer available." />}
    </Screen>
  );
}
