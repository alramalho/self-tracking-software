/* eslint-disable react-refresh/only-export-components */

import { useApiWithAuth } from "@/api";
import { useSession } from "@clerk/clerk-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";
import { toast } from "react-hot-toast";
import {
  fetchPlan,
  fetchPlanInvitation,
} from "./service";
import { PlansContext } from "./types";

export const usePlan = (
  id: string,
  options?: { includeActivities?: boolean }
) => {
  const { isSignedIn, isLoaded } = useSession();
  const api = useApiWithAuth();

  const plan = useQuery({
    queryKey: ["plan", id],
    queryFn: () => fetchPlan(api, id, options),
    enabled: isLoaded && isSignedIn && !!id,
  });

  return plan;
};

export const usePlanInvitation = (id: string) => {
  const { isSignedIn, isLoaded } = useSession();
  const queryClient = useQueryClient();
  const api = useApiWithAuth();

  const planInvitation = useQuery({
    queryKey: ["plan-invitation", id],
    queryFn: () => fetchPlanInvitation(api, id),
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

export const usePlans = () => {
  const context = useContext(PlansContext);
  if (context === undefined) {
    throw new Error("usePlans must be used within a PlansProvider");
  }
  return context;
};

// Re-exports
export { PlansProvider } from './provider';
export type { CompletePlan } from './types';

