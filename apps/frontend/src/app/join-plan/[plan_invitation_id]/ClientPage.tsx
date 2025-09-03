"use client";

import { ActivityCard } from "@/components/ActivityCard";
import PlanCard from "@/components/PlanCard";
import PlanSessionsRenderer from "@/components/PlanSessionsRenderer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useActivities } from "@/contexts/activities";
import {
  CompletePlan,
  usePlan,
  usePlanInvitation
} from "@/contexts/plans";
import { useUser } from "@/contexts/users";
import { useSession } from "@clerk/clerk-react";
import { Activity } from "@tsw/prisma";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ClientPage({
  params,
}: {
  params: { plan_invitation_id: string };
}) {
  const router = useRouter();

  const { isSignedIn } = useSession();
  const {
    planInvitation,
    isLoadingPlanInvitation: isLoading,
    acceptPlanInvitation,
    rejectPlanInvitation,
    isAcceptingPlanInvitation,
  } = usePlanInvitation(params.plan_invitation_id);

  const { data: inviter } = useUser({ id: planInvitation?.data?.senderId! });
  const [activityAssociations, setActivityAssociations] = useState<{
    [key: string]: string;
  }>({});
  const { activities } = useActivities();
  const { data: plan } = usePlan(planInvitation?.data?.planId!, { includeActivities: true });

  const handleActivityAssociation = (
    planActivityId: string,
    userActivityId: string
  ) => {
    setActivityAssociations((prev) => ({
      ...prev,
      [planActivityId]: userActivityId,
    }));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="mt-2">Loading Plan Data</p>
      </div>
    );
  }

  if (!plan || !inviter || !planInvitation?.data) {
    return <div>Error: Data not found</div>;
  }

  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-2xl">
          <div className="flex flex-col items-center mb-8 space-y-4">
            <Avatar className="w-16 h-16 mb-4">
              <AvatarImage
                src={inviter.picture || undefined}
                alt={inviter.name || undefined}
              />
              <AvatarFallback>{inviter.name?.[0]}</AvatarFallback>
            </Avatar>
            <h1 className="text-2xl font-medium text-center">
              {inviter.name} just invited you to join their plan
            </h1>
            <div className="mb-8 w-full">
              <PlanCard
                plan={plan as CompletePlan}
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
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col items-center mb-8">
          <Avatar className="w-16 h-16 mb-4">
            <AvatarImage src={inviter.picture || undefined} alt={inviter.name || undefined} />
            <AvatarFallback>{inviter.name?.[0]}</AvatarFallback>
          </Avatar>
          <h1 className="text-2xl font-medium text-center">
            {inviter.name} just invited you to join their plan
          </h1>
        </div>

        <div className="mb-8 w-full">
          <PlanCard
            plan={plan as CompletePlan}
            isSelected={false}
            onSelect={() => {}}
            onInviteSuccess={() => {}}
            hideInviteButton={true}
          />
        </div>

        <div className="w-full space-y-6">
          <h1 className="text-2xl font-medium">Plan Overview</h1>
          <PlanSessionsRenderer
            plan={plan as CompletePlan}
            activities={plan.activities || []}
          />
          <h1 className="text-2xl font-medium">Activity Associations</h1>
          <h2 className="text-lg font-light text-gray-500 mb-4">
            {plan.activities.length > 0
              ? "Now you need to decide whether to create new plan activities or associate an existing one."
              : "You don't have any activities yet. Please confirm creation for each plan activity:"}
          </h2>
          {plan.activities.map((planActivity: Activity) => (
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
                  {activities?.map((userActivity) => (
                    <option key={userActivity.id} value={userActivity.id}>
                      {userActivity.title}
                    </option>
                  ))}
                  <option value="new">Create new activity</option>
                </select>
              </div>
            </div>
          ))}
          {plan.activities.length === 0 && (
            <p>No activities to associate</p>
          )}
        </div>
        <div className="mt-8 w-full flex gap-4">
          <Button
            onClick={async () => {
              rejectPlanInvitation(params.plan_invitation_id);
            }}
            variant="destructive"
            className="flex-1"
          >
            Reject Invitation
          </Button>
          <Button
            onClick={() => acceptPlanInvitation(params.plan_invitation_id)}
            className="flex-1 bg-black text-white"
            disabled={
              Object.keys(activityAssociations).length !==
              plan.activities.length
            }
          >
            {isAcceptingPlanInvitation ? (
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
