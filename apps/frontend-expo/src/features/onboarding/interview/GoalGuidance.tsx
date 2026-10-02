import { CheckCircle2, CircleAlert } from "lucide-react-native";
import { View } from "react-native";
import type { GoalGuidanceResult, InterviewStage } from "@tsw/prisma/follow-through";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";

export const guidanceStep = (stage: InterviewStage) =>
  stage === "baseline" || stage === "motivation" ? stage : "goal";

export function initialGoalGuidance(stage: InterviewStage): GoalGuidanceResult {
  const step = guidanceStep(stage);
  return {
    requirements: [{
      key: step,
      label: step === "goal" ? "A clear target" : step === "baseline" ? "Starting point" : "Personal reason",
      phrase: step === "goal" ? "Say what you want to achieve." : step === "baseline" ? "Say where you are now." : "Say why this matters to you.",
      required: step === "goal",
      passed: false,
      detail: step === "goal" ? "Name the outcome you want to work towards." : "You can skip this step.",
    }],
  };
}

export function guidanceForStage(result: GoalGuidanceResult, stage: InterviewStage): GoalGuidanceResult {
  const step = guidanceStep(stage);
  const matched = result.requirements.find((item) => item.key === step || (step === "baseline" && item.key === "starting-point"));
  return matched
    ? { requirements: [{ ...matched, key: step }] }
    : initialGoalGuidance(stage);
}

export function GoalGuidance({ result, loading }: { result: GoalGuidanceResult; loading: boolean }) {
  const c = useColors();
  const check = result.requirements[0];
  if (!check) return null;
  const Icon = check.passed ? CheckCircle2 : CircleAlert;
  return (
    <View accessible accessibilityLabel="Answer check" testID="goal-guidance" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Icon size={17} color={check.passed ? "#10b981" : c.muted} />
      <Text style={{ color: check.passed ? c.text : c.muted, fontSize: 13, lineHeight: 19, flex: 1 }}>
        {loading ? "Checking your answer…" : check.detail}
      </Text>
    </View>
  );
}
