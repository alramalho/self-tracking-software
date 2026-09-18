import { ActivityIndicator, Image, View } from "react-native";
import { Check } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { PlanSummary } from "./PlanSummary";
import { WordReveal } from "./WordReveal";
import type { CoachValidationProps } from "./types";

function extractedDetail({ stage, result }: CoachValidationProps) {
  if (!result?.accepted) return undefined;
  const facts = result.facts;
  if (stage === "goal") return `${facts.emoji} ${facts.goal}`;
  if (stage === "baseline") return facts.baseline;
  if (stage === "rhythm") return `${facts.frequency} sessions a week`;
  if (stage === "support") return facts.recommendationReason;
  return undefined;
}

export function CoachValidation(props: CoachValidationProps) {
  const colors = useColors();
  const coach = props.strategist ? "Oli" : "Helly";
  const detail = extractedDetail(props);
  const needsImprovement =
    !!props.result?.accepted && !!props.result.needsImprovement;

  return (
    <View
      accessible
      accessibilityLabel={
        props.loading || !props.result
          ? `${coach} is checking your answer`
          : props.result.accepted
            ? needsImprovement
              ? `${coach} has one useful suggestion`
              : `${coach} found a clear direction`
            : `${coach} needs one more detail`
      }
      testID="coach-validation"
      style={{
        minHeight: 420,
        alignItems: "center",
        justifyContent: "center",
        gap: 26,
      }}
    >
      <Image
        accessibilityLabel={`${coach}, your coach`}
        source={
          props.strategist
            ? require("../../../../assets/coaches/oli.png")
            : require("../../../../assets/coaches/helly.png")
        }
        style={{ width: 112, height: 112 }}
        resizeMode="contain"
      />
      {props.loading || !props.result ? (
        <View style={{ alignItems: "center", gap: 14 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.muted, fontSize: 15 }}>
            {coach} is checking your answer…
          </Text>
        </View>
      ) : (
        <>
          <Text
            style={{
              color: colors.muted,
              fontSize: 13,
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            {props.result.accepted
              ? needsImprovement
                ? `${coach} has one useful suggestion`
                : `${coach} found a clear direction`
              : `${coach} needs one more detail`}
          </Text>
          <WordReveal onComplete={props.onMessageRendered}>
            {props.result.summary}
          </WordReveal>
          {props.result.accepted && props.stage === "review" ? (
            <View style={{ width: "100%" }}>
              <PlanSummary facts={props.result.facts} />
            </View>
          ) : detail ? (
            <View
              testID="onboarding-extraction"
              style={{
                width: "100%",
                padding: 16,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                backgroundColor: colors.card,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <Check size={18} color="#10b981" />
              <Text style={{ color: colors.text, flex: 1, lineHeight: 22 }}>
                {detail}
              </Text>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}
