import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FollowThroughSnapshot } from "@tsw/prisma/follow-through";
import { masterOn, planCoachingOn, supportFor } from "@tsw/prisma/follow-through/coach-inbox";
import { useApiWithAuth } from "@/api";
import type { CompletePlan } from "@/contexts/plans";
import type { CoachingSwitches } from "./types";

/** The coach's view of your plans: who is coached, what is paused, what waits on you. */
export function useFollowThrough() {
  const api = useApiWithAuth();
  return useQuery({
    queryKey: ["follow-through"],
    queryFn: async () => (await api.get<FollowThroughSnapshot>("/follow-through")).data,
    staleTime: 30_000,
  });
}

/**
 * The Coach tab's two kinds of switch, as on iPhone. The master one pauses or resumes every coach
 * reach-out and leaves each plan's own choice alone. A plan's switch sets that plan's coaching role
 * ("tracking" when off).
 */
export function useCoachingSwitches(): CoachingSwitches {
  const api = useApiWithAuth();
  const query = useFollowThrough();
  const client = useQueryClient();
  const state = query.data?.state;
  const canCoach = !!query.data?.canCoach;
  const refresh = () => client.invalidateQueries({ queryKey: ["follow-through"] });
  const master = useMutation({
    mutationFn: (enabled: boolean) => api.post("/follow-through/reach-outs", { enabled }),
    onSettled: refresh,
  });
  const plan = useMutation({
    mutationFn: async ({ target, on }: { target: CompletePlan; on: boolean }) => {
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
  };
}
