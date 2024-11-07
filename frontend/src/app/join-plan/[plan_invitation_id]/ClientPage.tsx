"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApiWithAuth } from "@/api";
import {
  convertApiPlanToPlan,
  convertPlanToApiPlan,
  User,
  useUserPlan,
  Activity,
  ApiPlan,
} from "@/contexts/UserPlanContext";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { ActivityCard } from "@/components/ActivityCard";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import PlanCard from "@/components/PlanCard"
import { Badge } from "@/components/ui/badge";
import PlanSessionsRenderer from "@/components/PlanSessionsRenderer";
import { useSession } from "@clerk/clerk-react";

interface PlanInvitationData {
  plan: ApiPlan;
  plan_activities: Activity[];
  inviter: {
    id: string;
    name: string;
    username: string;
    picture: string;
  };
  invitation: any;
}

export default function ClientPage({ params }: { params: { plan_invitation_id: string } }) {
  const router = useRouter();
  const api = useApiWithAuth();
  const { useUserDataQuery } = useUserPlan();
  const { isSignedIn } = useSession();

  const userData = useUserDataQuery("me");
  const [planData, setPlanData] = useState<PlanInvitationData | null>(null);
  const [activityAssociations, setActivityAssociations] = useState<{
    [key: string]: string;
  }>({});
  const [loading, setLoading] = useState(true);
  const [isAcceptingInvitation, setIsAcceptingInvitation] = useState(false);

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
      setIsAcceptingInvitation(true);
      await api.post(`/accept-plan-invitation/${params.plan_invitation_id}`, {
        activity_associations: activityAssociations,
      });
      userData.refetch();
      toast.success("Plan invitation accepted successfully!");
      router.push("/plans");
    } catch (error) {
      console.error("Error accepting plan invitation:", error);
      toast.error("Failed to accept plan invitation. Please try again.");
    } finally {
      setIsAcceptingInvitation(false);
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

  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-2xl">
          <div className="flex flex-col items-center mb-8 space-y-4">
            <Avatar className="w-16 h-16 mb-4">
              <AvatarImage
                src={planData.inviter.picture}
                alt={planData.inviter.name}
              />
              <AvatarFallback>{planData.inviter.name[0]}</AvatarFallback>
            </Avatar>
            <h1 className="text-2xl font-medium text-center">
              {planData.inviter.name} just invited you to join their plan
            </h1>
            <div className="mb-8 w-full">
              <PlanCard
                plan={planData.plan}
                isSelected={false}
                onSelect={() => {}}
                onInviteSuccess={() => {}}
                hideInviteButton={true}
              />
            </div>

            <span className="text-sm text-gray-500">
              You need to be signed in to accept this plan invitation.
            </span>
            <Button
              onClick={() =>
                router.push(
                  "/signin?redirect_url=/join-plan/" + params.plan_invitation_id
                )
              }
            >
              Sign In to accept
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (userData.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="mt-2">Loading Plan Data</p>
      </div>
    );
  }
  const hasUserActivities =
    planData && userData.data && userData.data.activities?.length > 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col items-center mb-8">
          <Avatar className="w-16 h-16 mb-4">
            <AvatarImage
              src={planData.inviter.picture}
              alt={planData.inviter.name}
            />
            <AvatarFallback>{planData.inviter.name[0]}</AvatarFallback>
          </Avatar>
          <h1 className="text-2xl font-medium text-center">
            {planData.inviter.name} just invited you to join their plan
          </h1>
        </div>

        <div className="mb-8 w-full">
          <PlanCard
            plan={planData.plan}
            isSelected={false}
            onSelect={() => {}}
            onInviteSuccess={() => {}}
            hideInviteButton={true}
          />
        </div>

        <div className="w-full space-y-6">
          <h1 className="text-2xl font-medium">Plan Overview</h1>
          <PlanSessionsRenderer
            plan={convertApiPlanToPlan(planData.plan, planData.plan_activities)}
            activities={planData.plan_activities || []}
          />
          <h1 className="text-2xl font-medium">Activity Associations</h1>
          <h2 className="text-lg font-light text-gray-500 mb-4">
            {hasUserActivities
              ? "Now you need to decide whether to create new plan activities or associate an existing one."
              : "You don't have any activities yet. Please confirm creation for each plan activity:"}
          </h2>
          {planData?.plan_activities.map((planActivity) => (
            <div key={planActivity.id} className="border p-4 rounded-lg">
              <div className="flex flex-row items-center justify-between">
                <div className="relative">
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
                  <Badge
                    className={`absolute text-white top-[-10px] right-[-10px] text-xs ${
                      activityAssociations[planActivity.id]
                        ? "bg-green-500"
                        : "bg-orange-500"
                    }`}
                    variant={
                      activityAssociations[planActivity.id]
                        ? "secondary"
                        : "default"
                    }
                  >
                    {activityAssociations[planActivity.id]
                      ? "Associated"
                      : "Pending"}
                  </Badge>
                </div>
              </div>

              <div className="mt-4">
                <select
                  value={activityAssociations[planActivity.id] || ""}
                  onChange={(e) =>
                    handleActivityAssociation(planActivity.id, e.target.value)
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="" disabled>
                    Select an activity
                  </option>
                  {userData.data?.activities.map((userActivity) => (
                    <option key={userActivity.id} value={userActivity.id}>
                      {userActivity.title}
                    </option>
                  ))}
                  <option value="new">Create new activity</option>
                </select>
              </div>
            </div>
          ))}
          {planData?.plan_activities.length === 0 && (
            <p>No activities to associate</p>
          )}
        </div>
        <div className="mt-8 w-full">
          <Button
            onClick={handleAcceptInvitation}
            className="w-full bg-black text-white"
            disabled={
              Object.keys(activityAssociations).length !==
                planData?.plan_activities.length
            }
          >
            {isAcceptingInvitation ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Accept Plan Invitation"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
