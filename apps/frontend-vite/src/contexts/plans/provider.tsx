import { useApiWithAuth } from "@/api";
import { useLogError } from "@/hooks/useLogError";
import { useSession } from "@clerk/clerk-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, PlanSession, Prisma } from "@tsw/prisma";
import { PlanMilestone } from "@tsw/prisma/types";
import React from "react";
import { toast } from "react-hot-toast";
import {
  clearCoachSuggestedSessionsInPlan,
  getPlans,
  modifyManualMilestone,
  updatePlans,
  upgradeCoachSuggestedSessionsToPlanSessions,
} from "./service";
import {
  PlansContext,
  type CompletePlan,
  type PlansContextType,
} from "./types";

export const PlansProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn, isLoaded } = useSession();
  const queryClient = useQueryClient();
  const api = useApiWithAuth();
  const { handleQueryError } = useLogError();
  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      console.log("fetching plans");
      const result = await getPlans(api);
      return result;
    },
    enabled: isLoaded && isSignedIn,
  });

  if (plans.error) {
    const customErrorMessage = `Failed to get plans`;
    handleQueryError(plans.error, customErrorMessage);
    toast.error(customErrorMessage);
  }

  const updatePlansMutation = useMutation({
    mutationFn: async (data: {
      updates: Array<{ planId: string; updates: Prisma.PlanUpdateInput }>;
      muteNotifications?: boolean;
    }) => {
      return await updatePlans(api, data.updates);
    },
    onSuccess: (result, { muteNotifications, updates }) => {
      if (result.success) {
        // Smartly update only the changed plans in the existing array
        queryClient.setQueryData(["plans"], (oldPlans: CompletePlan[] = []) => {
          return oldPlans.map((plan) => {
            const updateForPlan = updates.find((u) => u.planId === plan.id);
            return updateForPlan ? { ...plan, ...updateForPlan.updates } : plan;
          });
        });
        if (!muteNotifications) {
          toast.success("Plans updated successfully!");
        }
      }
    },
    onError: (error, { muteNotifications }) => {
      console.error("Error updating plans:", error);

      if (!muteNotifications) {
        toast.error("Failed to update plans. Please try again.");
      }
    },
  });

  const upsertPlanMutation = useMutation({
    mutationFn: async (data: {
      planId: string;
      updates: Prisma.PlanUpdateInput & {
        sessions?: Partial<PlanSession>[];
        milestones?: PlanMilestone[];
        activities?: Activity[];
      };
    }) => {
      if (!isSignedIn) throw new Error("Not signed in");
      console.log("upserting plan", data);
      const response = await api.post(`/plans/upsert`, {
        id: data.planId,
        ...data.updates,
      });
      return response.data;
    },
    onSuccess: (result, { planId }) => {
      const upsertedPlan = result.plan;

      // Handle cache updates based on operation type
      queryClient.setQueryData(["plans"], (oldPlans: CompletePlan[] = []) => {
        const planExists = oldPlans.some((plan) => plan.id === planId);

        if (upsertedPlan.deletedAt !== null) {
          // Deletion: Remove plan from cache
          return oldPlans.filter((plan) => plan.id !== planId);
        } else if (!planExists) {
          // Creation: Add new plan to cache
          return [...oldPlans, upsertedPlan];
        } else {
          // Update: Modify existing plan in cache
          return oldPlans.map((plan) =>
            plan.id === planId ? { ...plan, ...upsertedPlan } : plan
          );
        }
      });

      // Update individual plan cache
      if (upsertedPlan) {
        queryClient.setQueryData(["plan", planId], upsertedPlan);
      } else {
        // Remove from individual plan cache if deleted
        queryClient.removeQueries({ queryKey: ["plan", planId] });
      }

      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ["recommendations"] });
      }, 1000);
    },
    onError: (error) => {
      const customErrorMessage = `Failed to update plan`;
      handleQueryError(error, customErrorMessage);
      toast.error(customErrorMessage);
    },
  });

  const clearCoachSuggestedSessionsInPlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      await clearCoachSuggestedSessionsInPlan(api, planId);
    },
    onSuccess: () => {
      toast.success("Coach suggested sessions cleared successfully!");
    },
    onError: (error) => {
      const customErrorMessage = `Failed to clear coach suggested sessions in plan`;
      handleQueryError(error, customErrorMessage);
    },
  });

  const upgradeCoachSuggestedSessionsToPlanSessionsMutation = useMutation({
    mutationFn: async (planId: string) => {
      await upgradeCoachSuggestedSessionsToPlanSessions(api, planId);
    },
    onSuccess: () => {
      toast.success(
        "Coach suggested sessions upgraded to plan sessions successfully!"
      );
    },
    onError: (error) => {
      const customErrorMessage = `Failed to upgrade coach suggested sessions to plan sessions`;
      handleQueryError(error, customErrorMessage);
    },
  });

  const modifyManualMilestoneMutation = useMutation({
    mutationFn: async ({
      milestoneId,
      delta,
    }: {
      milestoneId: string;
      delta: number;
    }) => {
      await modifyManualMilestone(api, milestoneId, delta);
    },
    onSuccess: () => {
      toast.success("Milestone updated successfully!");
      queryClient.refetchQueries({ queryKey: ["plans"] });
    },
    onError: (error) => {
      const customErrorMessage = `Failed to modify manual milestone`;
      handleQueryError(error, customErrorMessage);
    },
  });

  const context: PlansContextType = {
    plans: plans.data as CompletePlan[] | undefined,
    isLoadingPlans: plans.isLoading,
    updatePlans: updatePlansMutation.mutateAsync,
    isUpdatingPlans: updatePlansMutation.isPending,
    upsertPlan: upsertPlanMutation.mutateAsync,
    isUpsertingPlan: upsertPlanMutation.isPending,
    modifyManualMilestone: modifyManualMilestoneMutation.mutateAsync,
    isModifyingManualMilestone: modifyManualMilestoneMutation.isPending,
    clearCoachSuggestedSessionsInPlan:
      clearCoachSuggestedSessionsInPlanMutation.mutateAsync,
    isClearingCoachSuggestedSessionsInPlan:
      clearCoachSuggestedSessionsInPlanMutation.isPending,
    upgradeCoachSuggestedSessionsToPlanSessions:
      upgradeCoachSuggestedSessionsToPlanSessionsMutation.mutateAsync,
    isUpgradingCoachSuggestedSessionsToPlanSessions:
      upgradeCoachSuggestedSessionsToPlanSessionsMutation.isPending,
  };

  return (
    <PlansContext.Provider value={context}>{children}</PlansContext.Provider>
  );
};
