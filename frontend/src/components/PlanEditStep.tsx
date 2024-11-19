import React from "react";
import { Activity, ApiPlan, GeneratedPlan, useUserPlan } from "@/contexts/UserPlanContext";
import { useApiWithAuth } from "@/api";
import PlanConfigurationForm from "./PlanConfigurationForm";

interface PlanEditStepProps {
  plan: ApiPlan;
  onClose: () => void;
  onPlanUpdated: () => void;
}

const PlanEditStep: React.FC<PlanEditStepProps> = ({
  plan,
  onClose,
  onPlanUpdated,
}) => {
  const api = useApiWithAuth();
  const { useUserDataQuery } = useUserPlan();
  const { data: userData } = useUserDataQuery("me");
  const userActivities = userData?.activities || [];

  const initialActivities = React.useMemo(() => 
    Array.from(new Set(
      plan.sessions.map(session => 
        userActivities.find(ua => ua.id === session.activity_id) || null
      ).filter((activity): activity is Activity => activity !== null)
    )),
    [plan.sessions, userActivities]
  );

  const handleConfirm = async (generatedPlan: GeneratedPlan) => {
    await api.post(`/plans/${plan.id}/update`, {
      updatedPlan: generatedPlan,
    });
    onPlanUpdated();
    onClose();
  };

  return (
    <PlanConfigurationForm
      initialActivities={initialActivities}
      goal={plan.goal}
      finishingDate={plan.finishing_date}
      onConfirm={handleConfirm}
      onClose={onClose}
      title={`${plan.goal} - Updated Version`}
      isEdit
    />
  );
};

export default PlanEditStep; 