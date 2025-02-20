import React, { useMemo } from "react";
import {
  SuggestionBase,
  PlanGoalSuggestionData,
  PlanActivitySuggestionData,
  PlanTypeSuggestionData,
  PlanSessionsSuggestionData,
  PlanMilestoneSuggestionData,
  PlanFinishingDateSuggestionData,
} from "@/types/suggestions";
import { toast } from "react-hot-toast";

// Helper function to format dates
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// Snippet Components
const PlanGoalSnippet: React.FC<{ goal: string }> = ({ goal }) => (
  <div className="border-l-4 border-blue-500 pl-3">
    <h3 className="font-medium text-sm text-gray-500">Goal</h3>
    <p className="text-gray-900">{goal}</p>
  </div>
);

const PlanActivitiesSnippet: React.FC<{
  activities: Array<{ activity_name: string; emoji: string; measure: string }>;
}> = ({ activities }) => (
  <div className="border-l-4 border-green-500 pl-3">
    <h3 className="font-medium text-sm text-gray-500">Activities</h3>
    <div className="flex flex-wrap gap-2">
      {activities.map((a, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded"
        >
          {a.emoji} {a.activity_name}
          <span className="text-xs text-gray-500">({a.measure})</span>
        </span>
      ))}
    </div>
  </div>
);

const PlanTypeSnippet: React.FC<{
  planType: "specific" | "times_per_week";
}> = ({ planType }) => {
  const emoji = planType === "specific" ? "📆" : "✅";

  console.log({ planType });
  return (
    <div className="border-l-4 border-purple-500 pl-3">
      <h3 className="font-medium text-sm text-gray-500">Plan Type</h3>
      <p className="text-gray-900 capitalize">
        <span className="text-xl">{emoji}</span> {planType}
      </p>
    </div>
  );
};

const PlanSessionsSnippet: React.FC<{
  sessions:
    | Array<{
        date: string;
        activity_name: string;
        quantity: number;
      }>
    | number;
}> = ({ sessions }) => (
  <div className="border-l-4 border-orange-500 pl-3">
    <h3 className="font-medium text-sm text-gray-500">Schedule</h3>
    {typeof sessions === "number" ? (
      <p className="text-gray-900">{sessions} times per week</p>
    ) : (
      <div className="space-y-2">
        {sessions.map((session, idx) => (
          <div key={idx} className="text-sm">
            <span className="text-gray-500">{formatDate(session.date)}</span>
            <span className="mx-2">-</span>
            <span>{session.activity_name}</span>
            <span className="text-gray-500 ml-2">({session.quantity})</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

const PlanMilestonesSnippet: React.FC<{
  milestones: Array<{
    description: string;
    date: string;
    criteria?: Array<{
      activity_id: string;
      quantity: number;
    }>;
    progress?: number;
  }>;
  activities?: Array<{
    activity_id: string;
    activity_name: string;
    emoji: string;
    measure: string;
  }>;
}> = ({ milestones, activities }) => (
  <div className="border-l-4 border-yellow-500 pl-3">
    <h3 className="font-medium text-sm text-gray-500">Milestones</h3>
    <div className="space-y-2">
      {milestones.map((milestone, idx) => {
        return (
          <div key={idx} className="bg-gray-50 p-2 rounded">
            <div className="flex justify-between items-start">
              <p className="text-gray-900">
                <span className="text-xl">⛳️</span> {milestone.description}
              </p>
              <span className="text-xs text-gray-500">
                {formatDate(milestone.date)}
              </span>
            </div>
            {milestone.criteria ? (
              <div className="mt-1 text-sm text-gray-600">
                <p className="font-medium">Criteria:</p>
                {milestone.criteria.map((c, i) => {
                  const activity = activities?.find(
                    (a) => a.activity_id === c.activity_id
                  );
                  return (
                    <p key={i} className="ml-2">
                      • {activity?.activity_name}: {c.quantity}{" "}
                    </p>
                  );
                })}
              </div>
            ) : (
              <p className="mt-1 text-sm text-gray-600 italic">
                Manual tracking
              </p>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

const PlanFinishingDateSnippet: React.FC<{
  finishing_date: string;
  explanation?: string;
}> = ({ finishing_date, explanation }) => (
  <div className="border-l-4 border-indigo-500 pl-3">
    <h3 className="font-medium text-sm text-gray-500">Finishing Date</h3>
    <div className="flex flex-col">
      <p className="text-gray-900">
        <span className="text-xl">🎯</span> {formatDate(finishing_date)}
      </p>
      {explanation && (
        <p className="text-sm text-gray-600 mt-1 italic">{explanation}</p>
      )}
    </div>
  </div>
);

export interface CompletePlan {
  goal: string;
  activities: Array<{
    activity_id: string;
    activity_name: string;
    emoji: string;
    measure: string;
  }>;
  planType: "specific" | "times_per_week";
  sessions:
    | Array<{
        date: string;
        activity_id: string;
        activity_name: string;
        quantity: number;
      }>
    | number;
  milestones?: Array<{
    description: string;
    date: string;
    criteria?: Array<{
      activity_name: string;
      quantity: number;
    }>;
    progress?: number;
  }>;
  finishing_date?: string;
}

interface PlanBuildingContainerProps {
  suggestions: SuggestionBase[];
  onPlanAccepted: (plan: CompletePlan) => Promise<void>;
  onPlanRejected: () => Promise<void>;
  disabled: boolean;
}

export const PlanBuildingContainer: React.FC<PlanBuildingContainerProps> = ({
  suggestions,
  onPlanAccepted,
  onPlanRejected,
  disabled,
}) => {
  const goalSuggestion = useMemo(
    () =>
      suggestions.filter((s) => s.type === "plan_goal").pop() as
        | PlanGoalSuggestionData
        | undefined,
    [suggestions]
  );

  const activitiesSuggestion = useMemo(
    () =>
      suggestions.filter((s) => s.type === "plan_activities").pop() as
        | PlanActivitySuggestionData
        | undefined,
    [suggestions]
  );

  const planTypeSuggestion = useMemo(
    () =>
      suggestions.filter((s) => s.type === "plan_type").pop() as
        | PlanTypeSuggestionData
        | undefined,
    [suggestions]
  );

  const sessionsSuggestion = useMemo(
    () =>
      suggestions.filter((s) => s.type === "plan_sessions").pop() as
        | PlanSessionsSuggestionData
        | undefined,
    [suggestions]
  );

  const milestonesSuggestion = useMemo(
    () =>
      suggestions.filter((s) => s.type === "plan_milestones").pop() as
        | PlanMilestoneSuggestionData
        | undefined,
    [suggestions]
  );

  const finishingDateSuggestion = useMemo(
    () =>
      suggestions.filter((s) => s.type === "plan_finishing_date").pop() as
        | PlanFinishingDateSuggestionData
        | undefined,
    [suggestions]
  );

  // Only show if we have at least a goal
  if (!goalSuggestion) return null;

  const isPlanComplete = Boolean(
    goalSuggestion &&
      activitiesSuggestion &&
      planTypeSuggestion &&
      sessionsSuggestion
  );

  const handleAccept = async () => {
    if (!isPlanComplete) return;

    try {
      await onPlanAccepted({
        goal: goalSuggestion.data.goal,
        activities: activitiesSuggestion!.data.activities,
        planType: planTypeSuggestion!.data.plan_type,
        sessions: sessionsSuggestion!.data.sessions,
        milestones: milestonesSuggestion?.data.milestones,
        finishing_date: finishingDateSuggestion?.data.finishing_date,
      });
      toast.success("Plan created successfully");
    } catch (error) {
      toast.error("Failed to create plan");
    }
  };

  const handleReject = async () => {
    try {
      await onPlanRejected();
      toast.success("Plan creation cancelled");
    } catch (error) {
      toast.error("Failed to reject plan");
    }
  };

  return (
    <div className="flex flex-col gap-4 bg-white p-4 rounded-lg shadow-sm">
      <PlanGoalSnippet goal={goalSuggestion.data.goal} />

      {activitiesSuggestion && (
        <PlanActivitiesSnippet
          activities={activitiesSuggestion.data.activities}
        />
      )}

      {finishingDateSuggestion && (
        <PlanFinishingDateSnippet
          finishing_date={finishingDateSuggestion.data.finishing_date}
          explanation={finishingDateSuggestion.data.explanation}
        />
      )}

      {planTypeSuggestion && (
        <PlanTypeSnippet planType={planTypeSuggestion.data.plan_type} />
      )}

      {sessionsSuggestion && (
        <PlanSessionsSnippet sessions={sessionsSuggestion.data.sessions} />
      )}

      {milestonesSuggestion && (
        <PlanMilestonesSnippet
          milestones={milestonesSuggestion.data.milestones}
          activities={activitiesSuggestion?.data.activities}
        />
      )}

      {isPlanComplete && (
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={handleAccept}
            disabled={disabled}
            className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
          >
            Accept Plan
          </button>
          <button
            onClick={handleReject}
            disabled={disabled}
            className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
          >
            Reject Plan
          </button>
        </div>
      )}
    </div>
  );
};
