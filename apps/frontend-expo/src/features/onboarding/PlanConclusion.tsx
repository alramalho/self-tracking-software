import { View } from "react-native";
import { Check } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { PlanConclusionProps } from "./types";

export function PlanConclusion({ facts, coaching, preferences }: PlanConclusionProps) {
  const c = useColors();
  const rows = [
    `${facts.frequency} ${facts.frequency === 1 ? "session" : "sessions"} per week`,
    facts.wantsCoaching
      ? coaching?.role === "training" ? "Training guidance and plan suggestions" : "Support staying consistent"
      : "Free activity tracking",
    facts.wantsCoaching && preferences?.weeklyReview
      ? `Weekly review · ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][preferences.reviewDay]} ${preferences.reviewTime}`
      : null,
    facts.wantsCoaching && coaching?.followUps ? "One useful follow-up, then quiet" : null,
  ].filter((row): row is string => !!row);
  return (
    <View testID="onboarding-plan-conclusion" style={{ backgroundColor: c.card, borderRadius: 18, padding: 18, gap: 14 }}>
      <Text style={{ color: c.text, fontSize: 19, lineHeight: 27, fontWeight: "600" }}>
        {facts.emoji} {facts.goal}
      </Text>
      <View style={{ gap: 10 }}>
        {rows.map((row) => (
          <View key={row} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Check size={17} color={c.accent} />
            <Text style={{ flex: 1, color: c.text, fontSize: 15, lineHeight: 21 }}>{row}</Text>
          </View>
        ))}
      </View>
      {facts.wantsCoaching && (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>
          Watch access: {coaching?.dataAccess.workouts ? "workouts on" : "workouts off"} · {coaching?.dataAccess.sleep ? "sleep on" : "sleep off"}. Edit in your plan.
        </Text>
      )}
    </View>
  );
}
