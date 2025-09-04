"use client";

import { useApiWithAuth } from "@/api";
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

  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      try {
        return await getPlans();
      } catch (error) {
        throw error;
      }
    },
    enabled: isLoaded && isSignedIn,
  });

  const updatePlansMutation = useMutation({
    mutationFn: async (data: {
      updates: Array<{ planId: string; updates: Prisma.PlanUpdateInput }>;
      muteNotifications?: boolean;
    }) => {
      return await updatePlans(data.updates);
    },
    onSuccess: ({}, { muteNotifications }) => {
      if (!muteNotifications) {
        toast.success("Plans updated successfully!");
      }
      queryClient.refetchQueries({ queryKey: ["plans"] });
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
      muteNotifications?: boolean;
    }) => {
      if (!isSignedIn) throw new Error("Not signed in");
      await api.post(`/plans/upsert`, {
        id: data.planId,
        ...data.updates,
      });
    },
    onSuccess: ({}, { muteNotifications }) => {
      if (!muteNotifications) {
        toast.success("Plan updated successfully!");
      }
      queryClient.refetchQueries({ queryKey: ["plans"] });
    },
    onError: (error, { muteNotifications }) => {
      console.error("Error updating plan:", error);
      if (!muteNotifications) {
        toast.error("Failed to update plan. Please try again.");
      }
    },
  });

  const clearCoachSuggestedSessionsInPlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      await clearCoachSuggestedSessionsInPlan(planId);
    },
    onSuccess: () => {
      toast.success("Coach suggested sessions cleared successfully!");
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
      console.error("Error modifying manual milestone:", error);
      toast.error("Failed to modify manual milestone. Please try again.");
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
