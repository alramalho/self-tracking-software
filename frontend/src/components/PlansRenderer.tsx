import React, { useState, useEffect } from "react";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { PlanRendererv2 } from "@/components/PlanRendererv2";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { ApiPlan, PlanGroup } from "@/contexts/UserPlanContext";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import InviteButton from "./InviteButton";

const PlansRenderer: React.FC = () => {
  const { userData, fetchUserData } = useUserPlan();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  
  useEffect(() => {
    console.log({ selectedPlanId });
  }, [selectedPlanId]);

  useEffect(() => {
    if (!selectedPlanId && userData && userData.me && userData.me.plans.length > 0) {
      const firstPlan = userData.me.plans[0];
      setSelectedPlanId(firstPlan.id || null);
    }
  }, [userData]);

  if (!userData || !userData.me || userData.me.plans.length === 0) {
    return <div>No plans available.</div>;
  }

  const { plans = [], activities = [], planGroups = [] } = userData.me;

  const getPlanGroup = (planId: string): PlanGroup | undefined => {
    return planGroups.find(group => group.plan_ids.includes(planId));
  };

  const handleInviteSuccess = () => {
    fetchUserData({ forceUpdate: true });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold mb-6">Your Plans</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {plans.map((plan) => {
          const planGroup = getPlanGroup(plan.id!);
          return (
            <div
              key={plan.id}
              className={`flex flex-col p-6 rounded-lg border-2 cursor-pointer hover:bg-gray-50 ${
                selectedPlanId === plan.id ? "border-blue-500" : "border-gray-200"
              }`}
              onClick={() => {
                console.log("seleecing plan", plan.id);
                setSelectedPlanId(plan.id || null);
              }}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center">
                  {plan.emoji && <span className="text-4xl mr-2">{plan.emoji}</span>}
                  <span className="text-xl font-medium">{plan.goal}</span>
                </div>
                <InviteButton planId={plan.id!} onInviteSuccess={handleInviteSuccess} />
              </div>
              <span className="text-sm text-gray-500 mb-4">
                📍{" "}
                {plan.finishing_date
                  ? new Date(plan.finishing_date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : ""}
              </span>
              {planGroup && planGroup.members && (
                <div className="flex items-center space-x-2">
                  {planGroup.members.map((member) => {
                    if (member.user_id === userData.me?.user?.id) {
                      return null;
                    }
                    return (
                      <Avatar key={member.user_id} className="w-8 h-8">
                        <AvatarImage
                          src={member.picture || ""}
                          alt={member.name || member.username}
                        />
                        <AvatarFallback>
                          {member.name?.[0] || member.username?.[0] || "U"}
                        </AvatarFallback>
                      </Avatar>
                    )
                  })}
                </div>
              )}
            </div>
          );
        })}
        <Link href="/create-new-plan" passHref>
          <Button
            variant="outline"
            className="w-full h-full flex flex-col items-center justify-center"
          >
            <Plus className="h-8 w-8 mb-2" />
            <span>Create New Plan</span>
          </Button>
        </Link>
      </div>

      {selectedPlanId && (
        <PlanRendererv2
          selectedPlan={plans.find((p) => p.id === selectedPlanId)!}
        />
      )}
    </div>
  );
};

export default PlansRenderer;
