import { View } from "react-native";
import { Text } from "@/components/typography/Text";
import { Panel, useColors } from "@/components/ui";
import type { HealthWorkoutPreview } from "../workout-types";
import { kilometreSplits, splitBarPercent, splitClock } from "./model";

export function KilometreSplits({ workout }: { workout: HealthWorkoutPreview }) {
  const c = useColors();
  const splits = kilometreSplits(workout);
  return (
    <Panel testID="kilometre-splits" style={{ gap: 14 }}>
      <View style={{ gap: 3 }}>
        <Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>Kilometre splits</Text>
        {splits.length > 0 && (
          <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17 }}>
            Longer bars mean faster pace · elapsed time includes pauses
          </Text>
        )}
      </View>
      {splits.length > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ color: c.muted, width: 66, fontSize: 11 }}>Split</Text>
          <Text style={{ color: c.muted, flex: 1, fontSize: 11 }}>Relative pace</Text>
          <Text style={{ color: c.muted, minWidth: 42, textAlign: "right", fontSize: 11 }}>Time</Text>
          <Text style={{ color: c.muted, minWidth: 61, textAlign: "right", fontSize: 11 }}>Pace</Text>
        </View>
      )}
      {splits.length ? splits.map((split) => (
        <View key={split.number} testID={`kilometre-split-${split.number}`}
          style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ color: c.text, width: 66, fontSize: 14, fontWeight: "600" }}>
            {split.partial ? `${(split.distanceMeters / 1000).toFixed(2)} km` : `${split.number} km`}
          </Text>
          <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: c.soft, overflow: "hidden" }}>
            <View testID={`kilometre-split-bar-${split.number}`}
              style={{ width: `${splitBarPercent(split, splits)}%`, height: 5, backgroundColor: "#38bdf8" }} />
          </View>
          <Text style={{ color: c.muted, minWidth: 42, textAlign: "right", fontSize: 13 }}>
            {splitClock(split.elapsedSeconds)}
          </Text>
          <Text style={{ color: c.text, minWidth: 61, textAlign: "right", fontSize: 14, fontWeight: "700" }}>
            {splitClock(split.paceSecondsPerKm)} /km
          </Text>
        </View>
      )) : (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>
          No reliable timed distance trace is available for this workout.
        </Text>
      )}
    </Panel>
  );
}
