import { router, useLocalSearchParams } from "expo-router";
import { Screen, Status, IconButton } from "@/components/ui";
import { ArrowLeft } from "lucide-react-native";
import { useHealthWorkouts } from "./queries";
import { WorkoutVitals } from "./WorkoutVitals";

export default function WorkoutVitalsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workouts = useHealthWorkouts();
  const item = workouts.data?.items.find((candidate) => candidate.healthWorkout.id === id);
  return (
    <Screen
      title="Workout details"
      subtitle="Your Apple Watch vitals"
      leading={<IconButton label="Back" icon={ArrowLeft} onPress={() => router.back()} />}
    >
      <Status loading={workouts.isPending} error={workouts.error} retry={() => void workouts.refetch()} />
      {item && <WorkoutVitals workout={item.healthWorkout} resolved={item.resolved} />}
      {!workouts.isPending && !item && <Status empty="This workout is no longer available." />}
    </Screen>
  );
}
