import { useApiWithAuth } from "@/api";
import { useSession } from "@/contexts/auth";
import { useLogError } from "@/hooks/useLogError";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Prisma, type Activity, type PlanSession } from "@tsw/prisma";
import { type PlanMilestone } from "@tsw/prisma/types";
import React, { useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { normalizePlanProgress } from "../plans-progress/service";
import {
  clearCoachSuggestedSessionsInPlan,
  deletePlan,
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
import { useCurrentUser } from "@/contexts/users";

export const PlansProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn, isLoaded } = useSession();
  const queryClient = useQueryClient();
  const api = useApiWithAuth();
  const { handleQueryError } = useLogError();
  const { currentUser } = useCurrentUser();
  const hasRunCoachingCheckRef = useRef(false);

  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      console.log("fetching plans");
      const result = await getPlans(api);
      return result;
    },
    select: (data) => data.map((plan) => ({
      ...plan,
      progress: normalizePlanProgress(plan.progress)
    })),
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
      // Invalidate and refetch to ensure proper data propagation
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["plan", planId] });
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
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

  const leavePlanGroupMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await api.post(`/plans/leave-plan-group/${planId}`);
      return response.data;
    },
    onSuccess: (_data, planId) => {
      // Optimistically update the plan in cache
      queryClient.setQueryData(["plans"], (oldPlans: CompletePlan[] = []) => {
        return oldPlans.map((plan) => {
          if (plan.id === planId) {
            // Remove plan group info when leaving
            return {
              ...plan,
              planGroupId: null,
              planGroup: null,
            };
          }
          return plan;
        });
      });

      // Also invalidate individual plan query if it exists
      queryClient.invalidateQueries({ queryKey: ["plan", planId] });

      toast.success("Left plan group successfully!");
    },
    onError: (error) => {
      const customErrorMessage = `Failed to leave plan group`;
      handleQueryError(error, customErrorMessage);
      toast.error(customErrorMessage);
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      await deletePlan(api, planId);
    },
    onSuccess: () => {
      // Invalidate and refetch plans
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast.success("Plan deleted successfully!");
    },
    onError: (error) => {
      const customErrorMessage = `Failed to delete plan`;
      handleQueryError(error, customErrorMessage);
      toast.error(customErrorMessage);
    },
  });

  // Safety check: Remove coaching flags from all plans if user is on FREE plan
  useEffect(() => {
    // Only run once when plans are loaded and user data is available
    if (
      !hasRunCoachingCheckRef.current &&
      plans.data &&
      currentUser &&
      !plans.isLoading
    ) {
      const isFreePlan = currentUser.planType === "FREE";

      if (isFreePlan) {
        const coachedPlans = plans.data.filter((plan) => plan.isCoached);

        if (coachedPlans.length > 0) {
          console.warn(
            `Found ${coachedPlans.length} coached plan(s) for FREE user. Removing coaching flags...`
          );

          // Build updates to remove coaching from all coached plans
          const updates = coachedPlans.map((plan) => ({
            planId: plan.id,
            updates: { isCoached: false } as Prisma.PlanUpdateInput,
          }));

          // Silently update the plans without showing toast notifications
          updatePlansMutation.mutate({ updates, muteNotifications: true });

          hasRunCoachingCheckRef.current = true;
        }
      }
    }
  }, [plans.data, plans.isLoading, currentUser, updatePlansMutation]);

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
    leavePlanGroup: leavePlanGroupMutation.mutateAsync,
    isLeavingPlanGroup: leavePlanGroupMutation.isPending,
    deletePlan: deletePlanMutation.mutateAsync,
    isDeletingPlan: deletePlanMutation.isPending,
  };

  return (
    <PlansContext.Provider value={context}>{children}</PlansContext.Provider>
  );
};
