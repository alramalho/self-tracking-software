import React, { useState, useEffect, useCallback } from "react";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { PlanRendererv2 } from "@/components/PlanRendererv2";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { ApiPlan, CompletedSession } from "@/contexts/UserPlanContext";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";

const PlansRenderer: React.FC = () => {
  const { userData, getCompletedSessions } = useUserPlan();
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [completedSessions, setCompletedSessions] = useState<{[username: string]: CompletedSession[]}>({});

  const fetchCompletedSessions = useCallback(async (plan: ApiPlan) => {
    setLoadingSessions(true);
    const sessionsMap: {[username: string]: CompletedSession[]} = {};
    for (const invitee of plan.invitees!) {
      const sessions = await getCompletedSessions(plan, invitee.username);
      sessionsMap[invitee.username] = sessions;
    }
    sessionsMap["me"] = await getCompletedSessions(plan);
    setCompletedSessions(sessionsMap);
    setLoadingSessions(false);
  }, []);

  useEffect(() => {
    if (!selectedPlanId && userData && userData.me && userData.me.plans.length > 0) {
      const firstPlan = userData.me.plans[0];
      setSelectedPlanId(firstPlan.id || null);
    }
  }, [userData]);

  useEffect(() => {
    if (selectedPlanId) {
      const selectedPlan = userData.me.plans.find(p => p.id === selectedPlanId);
      if (selectedPlan) {
        fetchCompletedSessions(selectedPlan);
      }
    }
  }, [selectedPlanId]);

  if (!userData || !userData.me || userData.me.plans.length === 0) {
    return <div>No plans available.</div>;
  }

  const { plans = [], activities = [] } = userData["me"] || {};

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold mb-6">Your Plans</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`grid grid-cols-[auto,auto] gap-4 p-6 rounded-lg border-2 cursor-pointer hover:bg-gray-50 ${
              selectedPlanId === plan.id ? "border-blue-500" : "border-gray-200"
            }`}
            onClick={() => setSelectedPlanId(plan.id || null)}
          >
            {plan.emoji && <span className="text-6xl">{plan.emoji}</span>}
            <div className="flex flex-col justify-">
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
            {plan.invitees && (
              <div className="flex items-center space-x-4 justify-end">
                {plan.invitees.map((invitee) => (
                  <div
                    key={invitee.user_id}
                    className="flex flex-row flex-nowrap ml-[30px] justify-content-end"
                  >
                  <Avatar className="border-[1px] border-gray-400 ml-[-30px]">
                    <AvatarImage
                      src={invitee.picture || ""}
                      alt={invitee.name || invitee.username}
                    />
                    <AvatarFallback>
                      {invitee.name?.[0] || invitee.username?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                </div>
                ))}
              </div>
            )}
          </div>
        ))}
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
       <>
        <PlanRendererv2
          selectedPlan={plans.find((p) => p.id === selectedPlanId)!}
          activities={activities}
          completedSessions={completedSessions}
          loadingSessions={loadingSessions}
        />
       </>
      )}
    </div>
  );
};

export default PlansRenderer;
