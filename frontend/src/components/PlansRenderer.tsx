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
import PlanCard from "./PlanCard";

const PlansRenderer: React.FC = () => {
  const { useUserDataQuery, fetchUserData } = useUserPlan();
  const userDataQuery = useUserDataQuery("me");
  const userData = userDataQuery.data;
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  
  useEffect(() => {
    console.log({ selectedPlanId });
  }, [selectedPlanId]);

  useEffect(() => {
    console.log({ userData });
    if (!selectedPlanId && userData && userData.plans &&userData.plans.length > 0) {
      const firstPlan = userData.plans[0];
      setSelectedPlanId(firstPlan.id || null);
    }
  }, [userData]);


  if (userData?.plans && userData.plans.length === 0) {
    return <div>No plans available.</div>;
  }

  const { plans = [], activities = [], planGroups = [] } = userData!;

  const getPlanGroup = (planId: string): PlanGroup | undefined => {
      return planGroups.find(group => group.plan_ids.includes(planId));
  };

  const handleInviteSuccess = () => {
    fetchUserData({ forceUpdate: true });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            planGroup={getPlanGroup(plan.id!)}
            isSelected={selectedPlanId === plan.id}
            currentUserId={userData?.user?.id}
            onSelect={(planId) => setSelectedPlanId(planId)}
            onInviteSuccess={handleInviteSuccess}
          />
        ))}
        <Link href="/create-new-plan" passHref>
          <Button
            variant="outline"
            className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300 text-gray-500"
          >
            <Plus className="h-8 w-8 mb-2 text-gray-400" />
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
