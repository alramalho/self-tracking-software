import React from 'react';
import { useUserPlan } from "@/contexts/UserPlanContext";
import { PlanRendererv2 } from "@/components/PlanRendererv2";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from 'next/link';

const PlansRenderer: React.FC = () => {
  const { plans, activities, getCompletedSessions } = useUserPlan();
  const [selectedPlanId, setSelectedPlanId] = React.useState<string | undefined>(undefined);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold mb-6">Your Plans</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`grid grid-cols-[auto,1fr] gap-4 p-6 rounded-lg border-2 cursor-pointer hover:bg-gray-50 ${
              selectedPlanId === plan.id ? "border-blue-500" : "border-gray-200"
            }`}
            onClick={() => setSelectedPlanId(plan.id)}
          >
            {plan.emoji && <span className="text-6xl">{plan.emoji}</span>}
            <div className="flex flex-col">
              <span className="text-xl font-medium">{plan.goal}</span>
              <span className="text-sm text-gray-500 mt-2">
                📍{" "}
                {plan.finishing_date
                  ? new Date(plan.finishing_date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : ""}
              </span>
            </div>
          </div>
        ))}
        <Link href="/create-new-plan" passHref>
          <Button
            variant="outline"
            className=" w-full h-full flex flex-col items-center justify-center"
          >
            <Plus className="h-8 w-8 mb-2" />
            <span>Create New Plan</span>
          </Button>
        </Link>
      </div>

      {selectedPlanId && (
        <PlanRendererv2
          selectedPlan={plans.find((p) => p.id === selectedPlanId)!}
          activities={activities}
          getCompletedSessions={getCompletedSessions}
        />
      )}
    </div>
  );
};

export default PlansRenderer;
