import { View } from "react-native";
import { Users } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { usePlans } from "@/data/queries";
import { useMyCircles } from "./api";
import type { CircleIntroHintProps } from "./types";

// While logging on a circle plan: where the log goes, and a nudge to say hi the first time.
export function CircleIntroHint({ activityId }: CircleIntroHintProps) {
  const c = useColors();
  const circles = useMyCircles();
  const plans = usePlans();
  const planIds = new Set(
    (plans.data ?? []).filter((p) => p.activities?.some((a) => a.id === activityId)).map((p) => p.id),
  );
  const circle = circles.data?.find((item) => planIds.has(item.planId));
  if (!circle) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }}>
      <Users size={20} color={c.text} strokeWidth={1.8} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 15 }}>{`Shares to ${circle.emoji} ${circle.name}`}</Text>
        {!circle.hasIntro && (
          <Text style={{ color: c.muted, fontSize: 13 }}>This is your intro. Say hi in the caption.</Text>
        )}
      </View>
    </View>
  );
}
