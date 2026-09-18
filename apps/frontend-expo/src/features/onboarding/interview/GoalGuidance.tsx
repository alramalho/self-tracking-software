import {
  Check,
  Circle,
  CircleAlert,
  Heart,
  Route,
  Target,
} from "lucide-react-native";
import { View } from "react-native";
import type { GoalGuidanceResult } from "@tsw/prisma/follow-through";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";

export const initialGoalGuidance: GoalGuidanceResult = {
  requirements: [
    {
      key: "goal",
      label: "A clear target",
      phrase: "What do you want to achieve?",
      required: true,
      passed: false,
      detail: "Name the outcome you want to work towards.",
    },
    {
      key: "starting-point",
      label: "Where you are now",
      phrase: "Your current starting point",
      required: false,
      passed: false,
      detail: "A useful detail for the next step, not a session prescription.",
    },
    {
      key: "motivation",
      label: "Why it matters",
      phrase: "What makes it worth doing?",
      required: false,
      passed: false,
      detail: "Helpful context, but you can continue without it.",
    },
  ],
};

function iconFor(key: string) {
  if (key.includes("motivat")) return Heart;
  if (key.includes("start") || key.includes("baseline")) return Route;
  return Target;
}

export function GoalGuidance({
  result,
  loading,
}: {
  result: GoalGuidanceResult;
  loading: boolean;
}) {
  const colors = useColors();
  return (
    <View
      accessible
      accessibilityLabel="What to include in your goal"
      testID="goal-guidance"
      style={{ gap: 8 }}
    >
      {result.requirements.map((requirement) => {
        const Icon = iconFor(requirement.key);
        const StatusIcon = requirement.passed
          ? Check
          : requirement.required
            ? CircleAlert
            : Circle;
        const statusColor = requirement.passed
          ? "#10b981"
          : requirement.required
            ? colors.accent
            : colors.muted;
        return (
          <View
            key={requirement.key}
            style={{
              minHeight: 48,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 13,
              borderWidth: 1,
              borderColor: requirement.passed
                ? "#10b98155"
                : colors.inputBorder,
              backgroundColor: colors.card,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              opacity: loading && !requirement.passed ? 0.7 : 1,
            }}
          >
            <Icon size={17} color={colors.accent} strokeWidth={2} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 13,
                  lineHeight: 17,
                  fontWeight: "700",
                }}
              >
                {requirement.label}
              </Text>
              <Text
                style={{ color: colors.muted, fontSize: 12, lineHeight: 16 }}
              >
                {requirement.phrase}
              </Text>
            </View>
            <StatusIcon size={16} color={statusColor} strokeWidth={2} />
          </View>
        );
      })}
    </View>
  );
}
