import React, { useState, useEffect } from "react";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { PlanRendererv2 } from "@/components/PlanRendererv2";
import { Button } from "@/components/ui/button";
import { Plus, PlusSquare } from "lucide-react";
import Link from "next/link";
import { ApiPlan, PlanGroup } from "@/contexts/UserPlanContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import InviteButton from "./InviteButton";
import PlanCard from "./PlanCard";
import { useRouter } from "next/navigation";
import Divider from "./Divider";

const PlansRenderer: React.FC = () => {
  const router = useRouter();
  const { useCurrentUserDataQuery, refetchUserData } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (
      !selectedPlanId &&
      userData &&
      userData.plans &&
      userData.plans.length > 0
    ) {
      const firstPlan = userData.plans[0];
      setSelectedPlanId(firstPlan.id || null);
    }
  }, [userData]);

  if (userData?.plans && userData.plans.length === 0) {
    return (
      <>
        <Link href="/create-new-plan" passHref>
          <Button
            variant="outline"
            className="bg-gray-50 w-full h-[100px] flex flex-col items-center justify-center border-2 border-dashed border-gray-300 text-gray-500"
          >
            <PlusSquare className="h-8 w-8 mb-2 text-gray-400" />
            <span>Create new Plan</span>
          </Button>
        </Link>
      </>
    );
  }

  const { plans = [], activities = [], planGroups = [] } = userData!;

  const getPlanGroup = (planId: string): PlanGroup | undefined => {
    return planGroups.find((group) => group.plan_ids.includes(planId));
  };

  const handleInviteSuccess = () => {
    refetchUserData();
  };

  const handlePlanRemoved = () => {
    refetchUserData();
  };

  const handlePlanSelect = (planId: string) => {
    if (selectedPlanId === planId) {
      setSelectedPlanId(null);
    } else {
      setSelectedPlanId(planId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 mb-6">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            planGroup={getPlanGroup(plan.id!)}
            isSelected={selectedPlanId === plan.id}
            currentUserId={userData?.user?.id}
            onSelect={handlePlanSelect}
            onInviteSuccess={handleInviteSuccess}
            onPlanRemoved={handlePlanRemoved}
          />
        ))}
        <Link href="/create-new-plan" passHref>
          <Button
            variant="outline"
            className="bg-gray-50 w-full h-full min-h-[120px] flex flex-col items-center justify-center border-2 border-dashed border-gray-300 text-gray-500"
          >
            <Plus className="h-6 w-6 mb-1 text-gray-400" />
            <span className="text-sm">Create New Plan</span>
          </Button>
        </Link>
      </div>

      <Divider />

      {selectedPlanId && plans.find((p) => p.id === selectedPlanId) && (
        <PlanRendererv2
          selectedPlan={plans.find((p) => p.id === selectedPlanId)!}
        />
      )}
    </div>
  );
};

export default PlansRenderer;
