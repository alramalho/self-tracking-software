import { View } from "react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { PlanSummaryProps } from "./types";
export function PlanSummary({ facts: f }: PlanSummaryProps) {
  const c = useColors();
  return (
    <View
      testID="onboarding-plan-summary"
      style={{
        borderRadius: 20,
        borderWidth: 1,
        borderColor: c.inputBorder,
        backgroundColor: c.card,
        padding: 20,
        gap: 18,
      }}
    >
      <Text
        style={{
          color: c.text,
          fontSize: 21,
          fontWeight: "600",
          lineHeight: 28,
        }}
      >
        {f.emoji} {f.goal}
      </Text>
      {[
        ["Why", f.goalReason],
        ["Starting point", f.baseline],
        [
          "Your week",
          `${f.frequency} sessions a week${f.commitment === "WEEKLY" ? " · flexible days" : ` · ${f.weekdays.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}${f.time ? ` at ${f.time}` : ""}`}`,
        ],
        ["You’ll track", `${f.activityTitle} · ${f.measure}`],
        ["First step", f.nextStep],
        ["Support", f.wantsCoaching ? "AI coaching" : "Simple tracking"],
        ["Resource", f.resourceName],
        ["Target date", f.targetDate],
      ]
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <View key={label} style={{ gap: 4 }}>
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: "500" }}>
              {label}
            </Text>
            <Text style={{ color: c.text, fontSize: 15, lineHeight: 22 }}>
              {value}
            </Text>
          </View>
        ))}
    </View>
  );
}
