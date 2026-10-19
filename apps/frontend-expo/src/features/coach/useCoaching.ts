import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/data/api";
import { useAiConsent } from "@/features/ai-consent/AiConsent";
import { useFollowThrough } from "@/features/follow-through/api";
import type { Plan } from "@/core/types";
import { masterOn, planCoachingOn, supportFor } from "./model";
import type { CoachingSwitches } from "./types";

/**
 * The Coach tab's two kinds of switch. The master one pauses or resumes every coach reach-out and
 * leaves each plan's own choice alone, so turning it back on restores them. A plan's switch sets that
 * plan's coaching role ("tracking" when off).
 */
export function useCoachingSwitches(): CoachingSwitches {
  const query = useFollowThrough();
  const client = useQueryClient();
  const consent = useAiConsent();
  const state = query.data?.state;
  const canCoach = !!query.data?.canCoach;
  const refresh = () => client.invalidateQueries({ queryKey: ["follow-through"] });
  const master = useMutation({
    mutationFn: (enabled: boolean) => api.post("/follow-through/reach-outs", { enabled }),
    onSettled: refresh,
  });
  const plan = useMutation({
    mutationFn: async ({ target, on }: { target: Plan; on: boolean }) => {
      if (on && !(await consent.ask())) return;
      const change = supportFor(state, target, on);
      await api.put(`/follow-through/plans/${target.id}`, change.support);
      if (change.resume) await api.post("/follow-through/coaching/resume", { planId: target.id });
    },
    onSettled: refresh,
  });
  const masterValue = master.isPending ? !!master.variables : masterOn(state);
  return {
    ready: !!query.data,
    canCoach,
    master: masterValue,
    setMaster: (on) => master.mutate(on),
    planOn: (planId) =>
      plan.isPending && plan.variables?.target.id === planId ? plan.variables.on : planCoachingOn(state, planId),
    canChangePlan: canCoach && masterValue && !plan.isPending,
    setPlan: (target, on) => plan.mutate({ target, on }),
    busy: master.isPending || plan.isPending,
    error: master.error ?? plan.error,
    consentSheet: consent.sheet,
  };
}
