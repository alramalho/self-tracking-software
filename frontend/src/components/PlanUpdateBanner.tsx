import React from "react";
import { Button } from "./ui/button";
import { Check, X } from "lucide-react";
import { useUserPlan } from "@/contexts/UserPlanContext";

export interface PlanSession {
  date: string;
  activity_id: string;
  descriptive_guide: string;
  quantity: number;
}

interface PlanUpdateBannerProps {
  sessions: PlanSession[];
  plan_id: string;
  onAccept: (sessions: PlanSession[]) => void;
  onReject: (sessions: PlanSession[]) => void;
}

const PlanUpdateBanner: React.FC<PlanUpdateBannerProps> = ({
  sessions,
  plan_id,
  onAccept,
  onReject,
}) => {
  const { useUserDataQuery } = useUserPlan();
  const { data: userData } = useUserDataQuery("me");
  const plan = userData?.plans.find((p) => p.id === plan_id);

  return (
    <div className="w-full max-w-md space-y-4">
      <div
        key={plan_id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{plan?.emoji || ""}</span>
                <div>
                  <h3 className="font-medium">{plan?.goal || "Plan Updates"}</h3>
                  <p className="text-sm text-gray-600">
                    {sessions.length} suggested updates
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => onAccept(sessions)}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Accept All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => onReject(sessions)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Reject All
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.date + session.activity_id}
                  className="text-sm text-gray-600 pl-4 border-l-2 border-gray-200"
                >
                  {session.descriptive_guide} on {session.date}
                </div>
              ))}
            </div>
      </div>
    </div>
  );
};

export default PlanUpdateBanner; 