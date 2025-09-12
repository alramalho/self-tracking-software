"use client";

import { useApiWithAuth } from "@/api";
import { useLogError } from "@/hooks/useLogError";
import { useSession } from "@clerk/clerk-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, PlanSession, Prisma } from "@tsw/prisma";
import { PlanMilestone } from "@tsw/prisma/types";
import React, { createContext, useContext } from "react";
import { toast } from "react-hot-toast";
import {
  clearCoachSuggestedSessionsInPlan,
  fetchPlan,
  fetchPlanInvitation,
  getPlans,
  modifyManualMilestone,
  updatePlans,
  upgradeCoachSuggestedSessionsToPlanSessions,
} from "./actions";

export type CompletePlan = Omit<
  Awaited<ReturnType<typeof getPlans>>[number],
  "milestones"
> & {
  milestones: PlanMilestone[];
};

interface PlansContextType {
  plans: CompletePlan[] | undefined;
  isLoadingPlans: boolean;
  updatePlans: (data: {
    updates: Array<{ planId: string; updates: Prisma.PlanUpdateInput }>;
    muteNotifications?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
  isUpdatingPlans: boolean;
  modifyManualMilestone: (data: {
    milestoneId: string;
    delta: number;
  }) => Promise<void>;
  isModifyingManualMilestone: boolean;
  upsertPlan: (data: {
    planId: string;
    updates: Prisma.PlanUpdateInput & {
      sessions?: Partial<PlanSession>[];
      milestones?: PlanMilestone[];
      activities?: Activity[];
    };
    muteNotifications?: boolean;
  }) => Promise<void>;
  isUpsertingPlan: boolean;
  clearCoachSuggestedSessionsInPlan: (planId: string) => Promise<void>;
  isClearingCoachSuggestedSessionsInPlan: boolean;
  upgradeCoachSuggestedSessionsToPlanSessions: (
    planId: string
  ) => Promise<void>;
  isUpgradingCoachSuggestedSessionsToPlanSessions: boolean;
}

const PlansContext = createContext<PlansContextType | undefined>(undefined);

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
      try {
        console.log("fetching plans")
        const result = await getPlans();
        return result;
      } catch (error) {
        throw error;
      }
    },
    enabled: isLoaded && isSignedIn,
  });

  if (plans.error) {
    let customErrorMessage = `Failed to get plans`;
    handleQueryError(plans.error, customErrorMessage);
    toast.error(customErrorMessage);
  }

  const updatePlansMutation = useMutation({
    mutationFn: async (data: {
      updates: Array<{ planId: string; updates: Prisma.PlanUpdateInput }>;
      muteNotifications?: boolean;
    }) => {
      return await updatePlans(data.updates);
    },
    onSuccess: (result, { muteNotifications, updates }) => {
      if (result.success) {
        // Smartly update only the changed plans in the existing array
        queryClient.setQueryData(["plans"], (oldPlans: CompletePlan[] = []) => {
          return oldPlans.map(plan => {
            const updateForPlan = updates.find(u => u.planId === plan.id);
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
      console.log("upserting plan", data)
      const response = await api.post(`/plans/upsert`, {
        id: data.planId,
        ...data.updates,
      });
      return response.data;
    },
    onSuccess: (result, { planId, updates }) => {
      const upsertedPlan = result.plan;
      
      // Handle cache updates based on operation type
      queryClient.setQueryData(["plans"], (oldPlans: CompletePlan[] = []) => {
        const planExists = oldPlans.some(plan => plan.id === planId);
        
        if (upsertedPlan.deletedAt !== null) {
          // Deletion: Remove plan from cache
          return oldPlans.filter(plan => plan.id !== planId);
        } else if (!planExists) {
          // Creation: Add new plan to cache
          return [...oldPlans, upsertedPlan];
        } else {
          // Update: Modify existing plan in cache
          return oldPlans.map(plan => 
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
      let customErrorMessage = `Failed to update plan`;
      handleQueryError(error, customErrorMessage);
      toast.error(customErrorMessage);
    },
  });

  const clearCoachSuggestedSessionsInPlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      await clearCoachSuggestedSessionsInPlan(planId);
    },
    onSuccess: () => {
      toast.success("Coach suggested sessions cleared successfully!");
    },
    onError: (error) => {
      let customErrorMessage = `Failed to clear coach suggested sessions in plan`;
      handleQueryError(error, customErrorMessage);
    },
  });

  const upgradeCoachSuggestedSessionsToPlanSessionsMutation = useMutation({
    mutationFn: async (planId: string) => {
      await upgradeCoachSuggestedSessionsToPlanSessions(planId);
    },
    onSuccess: () => {
      toast.success(
        "Coach suggested sessions upgraded to plan sessions successfully!"
      );
    },
    onError: (error) => {
      let customErrorMessage = `Failed to upgrade coach suggested sessions to plan sessions`;
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
      await modifyManualMilestone(milestoneId, delta);
    },
    onSuccess: () => {
      toast.success("Milestone updated successfully!");
      queryClient.refetchQueries({ queryKey: ["plans"] });
    },
    onError: (error) => {
      let customErrorMessage = `Failed to modify manual milestone`;
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

export const usePlans = () => {
  const context = useContext(PlansContext);
  if (context === undefined) {
    throw new Error("usePlans must be used within a PlansProvider");
  }
  return context;
};

export const usePlan = (
  id: string,
  options?: { includeActivities?: boolean }
) => {
  const { isSignedIn, isLoaded } = useSession();

  const plan = useQuery({
    queryKey: ["plan", id],
    queryFn: async () => {
      try {
        return await fetchPlan(id);
      } catch (error) {
        throw error;
      }
    },
    enabled: isLoaded && isSignedIn && !!id,
  });

  return plan;
};

// interface PlanInvitationData {
//   plan: CompletePlan;
//   plan_activities: Activity[];
//   inviter: {
//     id: string;
//     name: string;
//     username: string;
//     picture: string;
//   };
//   invitation: any;
// }

export const usePlanInvitation = (id: string) => {
  const { isSignedIn, isLoaded } = useSession();
  const queryClient = useQueryClient();
  const api = useApiWithAuth();
  const { handleQueryError } = useLogError();

  const planInvitation = useQuery({
    queryKey: ["plan-invitation", id],
    queryFn: async () => {
      try {
        return await fetchPlanInvitation(id);
      } catch (error) {
        throw error;
      }
    },
    enabled: isLoaded && isSignedIn && !!id,
  });

  const acceptPlanInvitationMutation = useMutation({
    mutationFn: async (planInvitationId: string) => {
      await api.post(`/plans/accept-plan-invitation/${planInvitationId}`);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["current-user"] });
      queryClient.refetchQueries({ queryKey: ["plans"] });
      toast.success("Plan invitation accepted successfully!");
    },
    onError: (error) => {
      console.error("Error accepting plan invitation:", error);
      toast.error("Failed to accept plan invitation. Please try again.");
    },
  });

  const rejectPlanInvitationMutation = useMutation({
    mutationFn: async (planInvitationId: string) => {
      await api.post(`/plans/reject-plan-invitation/${planInvitationId}`);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["current-user"] });
      queryClient.refetchQueries({ queryKey: ["plans"] });
      toast.success("Plan invitation rejected successfully!");
    },
    onError: (error) => {
      console.error("Error rejecting plan invitation:", error);
      toast.error("Failed to reject plan invitation. Please try again.");
    },
  });

  return {
    planInvitation,
    isLoadingPlanInvitation: planInvitation.isLoading,
    acceptPlanInvitation: acceptPlanInvitationMutation.mutateAsync,
    isAcceptingPlanInvitation: acceptPlanInvitationMutation.isPending,
    rejectPlanInvitation: rejectPlanInvitationMutation.mutateAsync,
    isRejectingPlanInvitation: rejectPlanInvitationMutation.isPending,
  };
};
