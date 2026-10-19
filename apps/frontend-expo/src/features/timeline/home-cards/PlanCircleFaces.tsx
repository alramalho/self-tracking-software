import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useColors } from "@/components/ui";
import { PersonAvatar } from "@/features/circles/components";
import { circleStatusLine } from "@/features/circles/model";
import type { PlanCircleFacesProps } from "./types";

const FACE_SIZE = 22;

/**
 * The plan's circle, folded into its card: who is in it (green ring = on track this week).
 * A forming circle shows its open spot. Tapping the faces opens the circle, not the plan.
 */
export function PlanCircleFaces({ circle }: PlanCircleFacesProps) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${circle.name}, ${circleStatusLine(circle)}`}
      hitSlop={10}
      onPress={() => router.push(`/circle/${circle.id}`)}
      style={({ pressed }) => ({ flexDirection: "row", paddingLeft: 6, opacity: pressed ? 0.7 : 1 })}
    >
      {circle.people.map((person, i) => (
        <View key={i} style={{ marginLeft: -6 }}>
          <PersonAvatar name={person.name} picture={person.picture} size={FACE_SIZE} ring={person.onTrack ? "on" : "off"} />
        </View>
      ))}
      {circle.status === "FORMING" && (
        <View
          style={{
            marginLeft: -6,
            width: FACE_SIZE + 6,
            height: FACE_SIZE + 6,
            borderRadius: 999,
            borderWidth: 2,
            borderStyle: "dashed",
            borderColor: c.muted,
            opacity: 0.6,
          }}
        />
      )}
    </Pressable>
  );
}
