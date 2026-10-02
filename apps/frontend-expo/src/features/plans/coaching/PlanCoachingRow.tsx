import { useState } from "react";
import { View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Copy, GroupedRows, Sheet, Status } from "@/components/ui";
import { api } from "@/data/api";
import { useFollowThrough } from "@/features/follow-through/api";
import { defaultSupport } from "@/features/follow-through/model";
import { days } from "@/features/follow-through/assistance/Inputs";
import { CoachingFields, initialCoaching } from "./CoachingFields";
import type { PlanCoachingProps } from "./types";
import type { PlanSupport } from "@tsw/prisma/follow-through";

export function PlanCoachingRow({
  plan,
  showPlanTitle,
  inlineEditor,
  onEditingChange,
  leadingRows = [],
}: PlanCoachingProps) {
  const query = useFollowThrough(),
    client = useQueryClient();
  const [draft, setDraft] = useState<PlanSupport>();
  const close = () => {
    setDraft(undefined);
    onEditingChange?.(false);
  };
  const support = query.data?.state.supports[plan.id] ?? defaultSupport(plan);
  const role =
    support.coaching?.role ??
    (support.preferences.coaching ? "consistency" : "tracking");
  const allPaused = query.data?.state.monitoring?.outreachPaused;
  const paused =
    allPaused || query.data?.state.monitoring?.pausedPlanIds.includes(plan.id);
  const summary = paused
    ? "Follow-ups paused"
    : role === "tracking"
      ? "Just tracking"
      : support.preferences.weeklyReview
        ? `${days[support.preferences.reviewDay]} ${support.preferences.reviewTime}`
        : "On demand";
  const save = useMutation({
    mutationFn: async () => api.put(`/follow-through/plans/${plan.id}`, draft),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["follow-through"] });
      close();
    },
  });
  const resume = useMutation({
    mutationFn: () =>
      allPaused
        ? api.post("/follow-through/reach-outs", { enabled: true })
        : api.post("/follow-through/coaching/resume", { planId: plan.id }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["follow-through"] }),
  });
  const editor = draft && (
    <>
      <Copy>{plan.goal}</Copy>
      <Copy muted>Times use {draft.timezone.replaceAll("_", " ")}</Copy>
      <CoachingFields
        value={draft.coaching!}
        preferences={draft.preferences}
        canCoach={!!query.data?.canCoach}
        onChange={(coaching) =>
          setDraft((current) => current && { ...current, coaching })
        }
        onPreferences={(preferences) =>
          setDraft((current) => current && { ...current, preferences })
        }
      />
      {paused && (
        <>
          <Copy muted>
            {allPaused
              ? "All coach reach-outs are paused."
              : "Your coach stopped following up after an unanswered question."}{" "}
            Messages still work.
          </Copy>
          <Button
            secondary
            busy={resume.isPending}
            onPress={() => resume.mutate()}
          >
            {allPaused ? "Resume coach reach-outs" : "Resume follow-ups"}
          </Button>
        </>
      )}
      <Button busy={save.isPending} onPress={() => save.mutate()}>
        Save coaching preferences
      </Button>
      {inlineEditor && (
        <Button secondary onPress={close}>
          Back to plans
        </Button>
      )}
      <Status error={save.error ?? resume.error} />
    </>
  );
  return (
    <>
      {(!inlineEditor || !draft) && (
        <GroupedRows
          rows={[
            ...leadingRows,
            {
              id: "coaching",
              icon: "🧭",
              title: showPlanTitle ? plan.goal : "Coaching",
              value: summary,
              disabled: !query.data,
              onPress: () => {
                onEditingChange?.(true);
                setDraft({
                  ...support,
                  coaching: support.coaching ?? { ...initialCoaching(), role },
                });
              },
            },
          ]}
        />
      )}
      <Status error={query.error} />
      {inlineEditor ? (
        <View style={{ gap: 14 }}>{editor}</View>
      ) : (
        <Sheet visible={!!draft} title="Coaching" onClose={close}>
          {editor}
        </Sheet>
      )}
    </>
  );
}
