import { useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import type { PlanDesign } from "@tsw/prisma/follow-through";
import { Status, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { api, errorMessage } from "@/data/api";
import { usePlan } from "@/data/queries";
import { goBack } from "@/core/navigation";
import { InterviewFrame } from "@/features/onboarding/interview/Frame";
import { OnboardingArt } from "@/features/onboarding/interview/OnboardingArt";
import { OnboardingButton } from "@/features/onboarding/interview/OnboardingButton";
import { StepSequence } from "@/features/onboarding/interview/StepReveal";
import { DesignSection } from "@/features/onboarding/design/DesignSection";
import { classifyGoal, suggestBaseline } from "@/features/onboarding/design/api";
import { initialDesign } from "@/features/onboarding/design/model";
import type { RedesignPlanProps } from "./types";

// "Plan this with my coach", for a plan that already exists. The same designer as onboarding:
// a starting point (from their own logs when there are some), the coach checking their days, two routes.
export function RedesignPlan({ planId }: RedesignPlanProps) {
  const c = useColors();
  const client = useQueryClient();
  const plan = usePlan(planId);
  const [phase, setPhase] = useState<"reading" | "baseline" | "design">("reading");
  const [design, setDesign] = useState<PlanDesign>();
  const [question, setQuestion] = useState("Where are you now?");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<unknown>();
  const [saving, setSaving] = useState(false);
  const started = useRef(false);
  const logged = useRef<PlanDesign["baseline"] | null>(null);

  useEffect(() => {
    const p = plan.data;
    if (!p || started.current) return;
    const a = p.activities?.[0];
    if (!a) {
      setError(new Error("This plan has no activity yet. Add one first."));
      return;
    }
    started.current = true;
    void (async () => {
      try {
        const classified = await classifyGoal(p.goal);
        logged.current = await suggestBaseline({ title: a.title, measure: a.measure }).catch(() => null);
        const days = Math.max(1, Math.min(7, Math.round(p.timesPerWeek || 3)));
        const next = initialDesign(
          { ...classified, activity: { key: a.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "activity", title: a.title, measure: a.measure, emoji: a.emoji ?? p.emoji ?? "🎯" } },
          "",
          days,
        );
        setDesign(next);
        setQuestion(classified.baselineQuestion);
        setAnswer(logged.current?.text ?? "");
        setPhase("baseline");
      } catch (e) {
        started.current = false;
        setError(e);
      }
    })();
  }, [plan.data]);

  async function apply(done: PlanDesign) {
    setSaving(true);
    setError(undefined);
    try {
      await api.post(`/follow-through/plans/${planId}/redesign`, { design: done });
      await client.invalidateQueries();
      router.replace(`/plan/${planId}` as never);
    } catch (e) {
      setError(e);
      setSaving(false);
    }
  }

  if (phase === "design" && design)
    return (
      <>
        <DesignSection
          design={design}
          goal={plan.data?.goal ?? ""}
          goalReason={plan.data?.goalReason ?? ""}
          timezone={Intl.DateTimeFormat().resolvedOptions().timeZone}
          preview={false}
          busy={saving}
          onChange={setDesign}
          onBack={() => setPhase("baseline")}
          onClose={goBack}
          onDone={(d) => void apply(d)}
        />
      </>
    );
  return (
    <InterviewFrame
      stage="baseline"
      transitionKey={`redesign-${phase}`}
      progress={{ current: 1, total: 12, label: "Your starting point" }}
      preview={false}
      busy={phase === "reading"}
      backDisabled
      onBack={() => {}}
      onClose={goBack}
      actions={
        phase === "baseline" ? (
          <OnboardingButton
            label="Continue"
            disabled={!answer.trim()}
            onPress={() => {
              setDesign((d) => d && { ...d, baseline: { text: answer.trim(), measurements: logged.current?.text === answer.trim() ? logged.current.measurements : [] } });
              setPhase("design");
            }}
          />
        ) : (
          <View />
        )
      }
    >
      <StepSequence prefix="redesign-baseline" style={{ alignItems: "center", gap: 20 }}>
        <OnboardingArt name="baseline" size={150} />
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: 32, lineHeight: 38, fontWeight: "700", textAlign: "center", letterSpacing: -0.5 }}>
          {phase === "reading" ? "Reading your plan…" : question}
        </Text>
        {phase === "baseline" && (
          <>
            <TextInput
              testID="redesign-baseline"
              accessibilityLabel="Your answer"
              value={answer}
              onChangeText={setAnswer}
              multiline
              placeholder="In your own words…"
              placeholderTextColor={c.muted}
              style={{ alignSelf: "stretch", minHeight: 132, borderRadius: 16, borderWidth: 1, borderColor: c.inputBorder, backgroundColor: c.card, padding: 18, fontSize: 17, lineHeight: 25, color: c.text, textAlignVertical: "top" }}
            />
            {!!logged.current && answer === logged.current.text && (
              <Text style={{ color: c.muted, fontSize: 14 }}>From your logs. Edit it if it’s not the full picture.</Text>
            )}
          </>
        )}
      </StepSequence>
      <Status error={error ? new Error(errorMessage(error)) : undefined} retry={() => setError(undefined)} />
    </InterviewFrame>
  );
}
