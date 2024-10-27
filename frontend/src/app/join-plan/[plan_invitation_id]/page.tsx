"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApiWithAuth } from "@/api";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { Activity, Plan } from "@/contexts/UserPlanContext";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { ActivityEntryCard } from "@/components/ActivityEntryCard";
import { ActivityCard } from "@/components/ActivityCard";
import { PlusCircle } from "lucide-react";

interface PlanInvitationData {
  plan: Plan;
  plan_activities: Activity[];
  user_activities: Activity[];
  invitation: any;
}

const JoinPlanPage: React.FC<{ params: { plan_invitation_id: string } }> = ({
  params,
}) => {
  const router = useRouter();
  const api = useApiWithAuth();
  const { fetchUserData } = useUserPlan();
  const [planData, setPlanData] = useState<PlanInvitationData | null>(null);
  const [activityAssociations, setActivityAssociations] = useState<{
    [key: string]: string;
  }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlanData = async () => {
      try {
        const response = await api.get(
          `/get-plan-from-invitation-id/${params.plan_invitation_id}`
        );
        setPlanData(response.data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching plan data:", error);
        toast.error("Failed to load plan data. Please try again.");
        setLoading(false);
      }
    };

    fetchPlanData();
  }, [params.plan_invitation_id]);

  const handleActivityAssociation = (
    planActivityId: string,
    userActivityId: string
  ) => {
    setActivityAssociations((prev) => ({
      ...prev,
      [planActivityId]: userActivityId,
    }));
  };


  const handleAcceptInvitation = async () => {
    try {
      await api.post(`/accept-plan-invitation/${params.plan_invitation_id}`, {
        activity_associations: activityAssociations,
      });
      await fetchUserData({ forceUpdate: true });
      toast.success("Plan invitation accepted successfully!");
      router.push("/");
    } catch (error) {
      console.error("Error accepting plan invitation:", error);
      toast.error("Failed to accept plan invitation. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="mt-2">Loading Plan Data</p>
      </div>
    );
  }

  if (!planData) {
    return <div>Error: Plan data not found</div>;
  }

  const hasUserActivities = planData && planData.user_activities.length > 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">
        Accept Plan Invitation for {planData?.plan.goal}
      </h1>
      <div className="space-y-6">
        <h2 className="text-lg font-light text-gray-500 mb-4">
          {hasUserActivities
            ? "Here you will need to decide whether to create new plan activities or associate an existing one."
            : "You don't have any activities yet. The following activities will be created for your plan:"}
        </h2>
        {planData?.plan_activities.map((planActivity) => (
          <div key={planActivity.id} className="border p-4 rounded-lg">
            <div className="flex flex-row items-center justify-between">
              <ActivityCard
                key={planActivity.id}
                activity={planActivity}
                onClick={() => {
                  document
                    .getElementById(`${planActivity.id}-association`)
                    ?.focus();
                }}
                selected={false}
              />
            </div>

            {hasUserActivities && (
              <div className="mt-2">
                <select
                  id={`${planActivity.id}-association`}
                  className="w-full p-2 border rounded"
                  value={activityAssociations[planActivity.id] || ""}
                  onChange={(e) =>
                    handleActivityAssociation(planActivity.id, e.target.value)
                  }
                >
                  <option value="">Select an activity</option>
                  {planData.user_activities.map((userActivity) => (
                    <option key={userActivity.id} value={userActivity.id}>
                      {userActivity.title}
                    </option>
                  ))}
                  <option value="new">Create new activity</option>
                </select>
              </div>
            )}

          </div>
        ))}
        {planData?.plan_activities.length === 0 && (
          <p>No activities to associate</p>
        )}
      </div>
      <div className="mt-8">
        <Button
          onClick={handleAcceptInvitation}
          className="w-full bg-black text-white"
          disabled={
            hasUserActivities &&
            Object.keys(activityAssociations).length !==
              planData?.plan_activities.length
          }
        >
          Accept Plan Invitation
        </Button>
      </div>
    </div>
  );
};

export default JoinPlanPage;
