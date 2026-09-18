import { useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, View } from "react-native";
import { ChevronRight, HeartPulse } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { radii } from "@/components/radii";
import { useHealth } from "./HealthProvider";
import { useHealthWorkouts } from "./queries";
import { WorkoutReview } from "./WorkoutReview";
import type { WorkoutReconciliationPreviewItem } from "./workout-types";

export function HealthHomeCard() {
  const health = useHealth(),
    workouts = useHealthWorkouts();
  const c = useColors();
  const [selected, setSelected] = useState<WorkoutReconciliationPreviewItem>();
  const pending = workouts.data?.items.filter((item) => !item.resolved) ?? [];
  const count =
    health.status?.connected || health.garmin.status?.connected
      ? (workouts.data?.summary.pending ?? 0)
      : 0;
  if (
    !selected &&
    !count &&
    !health.error &&
    !health.busy &&
    !health.garmin.error &&
    !health.garmin.busy
  )
    return null;
  const action = count ? "Review workouts" : "Open health settings";
  const title = count
    ? `${count} ${count === 1 ? "workout" : "workouts"} ready`
    : health.busy || health.garmin.busy
      ? "Syncing connected health"
      : "Connected health needs attention";
  const detail = count
    ? count === 1
      ? "Review before logging"
      : "Review together in one batch"
    : health.busy || health.garmin.busy
      ? "Looking for new workouts"
      : "Open settings to reconnect";
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action}
        accessibilityHint={`${title}. ${detail}.`}
        disabled={health.busy || health.garmin.busy}
        onPress={() =>
          pending[0] ? setSelected(pending[0]) : router.push("/health")
        }
        testID="health-home-card"
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: c.card,
          borderColor: c.border,
          borderRadius: radii.card,
          borderWidth: 1,
          flexDirection: "row",
          gap: 12,
          minHeight: 72,
          opacity: pressed ? 0.72 : 1,
          paddingHorizontal: 14,
          paddingVertical: 12,
        })}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: c.selectedBg,
            borderRadius: 20,
            height: 40,
            justifyContent: "center",
            width: 40,
          }}
        >
          {health.busy ? (
            <ActivityIndicator color={c.accent} size="small" />
          ) : (
            <HeartPulse color={c.accent} size={20} strokeWidth={1.9} />
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{ color: c.text, fontSize: 15, fontWeight: "600" }}
          >
            {title}
          </Text>
          <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13 }}>
            {detail}
          </Text>
        </View>
        {!health.busy && !health.garmin.busy && (
          <ChevronRight color={c.muted} size={19} strokeWidth={1.8} />
        )}
      </Pressable>
      {selected && (
        <WorkoutReview
          item={selected}
          items={pending}
          onClose={() => setSelected(undefined)}
        />
      )}
    </>
  );
}
