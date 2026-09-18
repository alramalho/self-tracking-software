import { View } from "react-native";
import { HeartPulse, Watch } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { workoutIcon } from "./icon";
import { relativeDateLabel, timeLabel } from "./date";
import type { DetectedWorkoutCardProps } from "./types";
import {
  workoutEffortLabel,
  workoutHeartRateSummary,
} from "../workout-model";

export function DetectedWorkoutCard({ workout }: DetectedWorkoutCardProps) {
  const c = useColors();
  const WorkoutIcon = workoutIcon(workout.activityTypeName);
  const distance =
    workout.distanceMeters == null
      ? ""
      : ` · ${(workout.distanceMeters / 1000).toFixed(1)} km`;
  const effort = workoutEffortLabel(workout);
  const heartRate = workoutHeartRateSummary(workout);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Watch size={15} color={c.muted} strokeWidth={1.8} />
        <Text style={{ color: c.muted, fontSize: 13 }}>
          Apple Watch workout
        </Text>
      </View>
      <View
        accessibilityLabel={`Apple Watch workout: ${workout.displayName}`}
        style={{
          borderRadius: 16,
          padding: 16,
          backgroundColor: c.soft,
          borderWidth: 1,
          borderColor: c.accent + "55",
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.accent + "18",
          }}
        >
          <WorkoutIcon size={23} color={c.accent} strokeWidth={1.7} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
            {workout.displayName}
          </Text>
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>
            {relativeDateLabel(workout.startAt)} · {timeLabel(workout.startAt)}{" "}
            · {Math.round(workout.durationSeconds / 60)} min
            {distance}
          </Text>
          {effort && (
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
              {effort}
            </Text>
          )}
          {heartRate && (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
            >
              <HeartPulse
                accessibilityElementsHidden
                color={c.muted}
                size={13}
                strokeWidth={1.8}
              />
              <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
                {heartRate}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
