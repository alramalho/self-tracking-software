import React from "react";
import { Button } from "./ui/button";
import { Check, X } from "lucide-react";
import { useUserPlan } from "@/contexts/UserPlanContext";

export interface PlanSession {
  date: string;
  activityId: string;
  descriptive_guide: string;
  quantity: number;
}

interface PlanUpdateBannerProps {
  sessions: PlanSession[];
  old_sessions: PlanSession[];
  plan_id: string;
  onAccept: (sessions: PlanSession[]) => void;
  onReject: (sessions: PlanSession[]) => void;
  disabled: boolean;
}

const PlanUpdateBanner: React.FC<PlanUpdateBannerProps> = ({
  sessions,
  old_sessions,
  plan_id,
  onAccept,
  onReject,
  disabled,
}) => {
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const plan = userData?.plans.find((p) => p.id === plan_id);

  return (
    <div className="w-full max-w-md space-y-4">
      <div
        key={plan_id}
        className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              disabled={disabled}
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
              disabled={disabled}
            >
              <X className="w-4 h-4 mr-2" />
              Reject All
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {old_sessions && old_sessions.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Sessions to be removed:</h4>
              <div className="space-y-2">
                {old_sessions.map((session) => {
                  const activity = userData?.activities.find((a) => a.id === session.activityId);
                  const formattedDate = new Date(session.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                  return (
                    <div
                      key={session.date + session.activityId}
                      className="flex items-center space-x-2 text-sm text-gray-600 pl-4 border-l-2 border-red-200 bg-red-50/50 p-2 rounded-r-md"
                    >
                      <span className="text-lg">{activity?.emoji}</span>
                      <span>
                        {activity?.title} ({session.quantity} {activity?.measure}) on {formattedDate}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {sessions && sessions.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Sessions to be added:</h4>
              <div className="space-y-2">
                {sessions.map((session) => {
                  const activity = userData?.activities.find((a) => a.id === session.activityId);
                  const formattedDate = new Date(session.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                  return (
                    <div
                      key={session.date + session.activityId}
                      className="flex items-center space-x-2 text-sm text-gray-600 pl-4 border-l-2 border-green-200 bg-green-50/50 p-2 rounded-r-md"
                    >
                      <span className="text-lg">{activity?.emoji}</span>
                      <span>
                        {activity?.title} ({session.quantity} {activity?.measure}) on {formattedDate}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanUpdateBanner; 