import { useState } from "react";
import { ApiPlan, useUserPlan } from "@/contexts/UserPlanContext";
import { useApiWithAuth } from "@/api";
import toast from "react-hot-toast";

export function usePlanEdit() {
  const [showEditModal, setShowEditModal] = useState(false);
  const api = useApiWithAuth();
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();

  const handleEditPlan = async (plan: ApiPlan, updatedPlan: ApiPlan) => {
    try {
      await api.post(`/plans/${plan.id}/update`, {
        data: updatedPlan,
      });
      currentUserDataQuery.refetch();
      setShowEditModal(false);
      toast.success("Plan updated successfully");
    } catch (error) {
      console.error("Failed to update plan:", error);
      toast.error("Failed to update plan");
    }
  };

  return {
    showEditModal,
    setShowEditModal,
    handleEditPlan,
  };
} 