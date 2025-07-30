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
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useUserPlan } from "@/contexts/UserPlanContext";

const PLAN_CREATION_ASSISTANT_MEMORY_IN_MINUTES = 180; // 3 hours

const areSuggestionsValid = (timestamp: number) => {
  const now = Date.now();
  const minutesSinceCache = (now - timestamp) / (1000 * 60);
  return minutesSinceCache < PLAN_CREATION_ASSISTANT_MEMORY_IN_MINUTES;
};

// Helper function to format dates
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDateWithWeekday = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "short",
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
  activities: Array<{
    id: string;
    name: string;
    emoji: string;
    measure: string;
  }>;
}> = ({ activities }) => (
  <div className="border-l-4 border-green-500 pl-3">
    <h3 className="font-medium text-sm text-gray-500">Activities</h3>
    <div className="flex flex-wrap gap-2">
      {activities.map((a, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded"
        >
          {a.emoji} {a.name}
          <span className="text-xs text-gray-500">({a.measure})</span>
        </span>
      ))}
    </div>
  </div>
);

const PlanTypeSnippet: React.FC<{
  planType: "specific" | "timesPerWeek";
}> = ({ planType }) => {
  const emoji = planType === "specific" ? "📆" : "✅";

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
        activityId: string;
        activityName: string;
        quantity: number;
      }>
    | number;
  activities: Array<{
    id: string;
    name: string;
    emoji?: string;
    measure: string;
  }>;
}> = ({ sessions, activities }) => (
  <div className="border-l-4 border-orange-500 pl-3">
    <h3 className="font-medium text-sm text-gray-500">Schedule</h3>
    {typeof sessions === "number" ? (
      <p className="text-gray-900">{sessions} times per week</p>
    ) : (
      <div className="space-y-2">
        {sessions.map((session, idx) => {
          const activity = activities?.find(
            (a) => a.id === session.activityId
          );
          return (
            <div key={idx} className="text-sm border-l-2 border-orange-200 pl-2">
              <span>
                {activity?.emoji} {session.activityName}
              </span>
              <span className="text-gray-500 ml-2">
                ({session.quantity} {activity?.measure})
              </span>
              <br/>
              <span className="text-gray-500 text-md">
                📍 {formatDateWithWeekday(session.date)}
              </span>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

const PlanMilestonesSnippet: React.FC<{
  milestones: Array<{
    description: string;
    date: string;
    criteria?: Array<{
      activityId: string;
      quantity: number;
    }>;
    progress?: number;
  }>;
  activities?: Array<{
    id: string;
    name: string;
    emoji?: string;
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
                  console.log({ activities });
                  const activity = activities?.find(
                    (a) => a.id === c.activityId
                  );
                  console.log({ c });
                  console.log({ activity });
                  return (
                    <p key={i} className="ml-2">
                      • {activity?.name}: {c.quantity}{" "}
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
  finishingDate: string;
  explanation?: string;
}> = ({ finishingDate, explanation }) => (
  <div className="border-l-4 border-indigo-500 pl-3">
    <h3 className="font-medium text-sm text-gray-500">Finishing Date</h3>
    <div className="flex flex-col">
      <p className="text-gray-900">
        <span className="text-xl">🎯</span> {formatDate(finishingDate)}
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
    id: string;
    name: string;
    emoji: string;
    measure: string;
  }>;
  planType: "specific" | "timesPerWeek";
  sessions:
    | Array<{
        date: string;
        activityId: string;
        activityName: string;
        quantity: number;
      }>
    | number;
  milestones?: Array<{
    description: string;
    date: string;
    criteria?: Array<{
      activityId: string;
      quantity: number;
    }>;
    progress?: number;
  }>;
  finishingDate?: string;
  createdAt?: string;
}

interface PlanBuildingContainerProps {
  suggestions: SuggestionBase[];
  onPlanAccepted: (plan: CompletePlan) => Promise<void>;
  onPlanRejected: () => Promise<void>;
  disabled: boolean;
}

export const PlanBuildingContainer: React.FC<PlanBuildingContainerProps> = ({
  suggestions: incomingSuggestions,
  onPlanAccepted,
  onPlanRejected,
  disabled,
}) => {
  const { useCurrentUserDataQuery } = useUserPlan();
  const { data: currentUser } = useCurrentUserDataQuery();
  const activities = currentUser?.activities;
  const [cachedData, setCachedData] = useLocalStorage<{
    suggestions: SuggestionBase[];
    timestamp: number;
  } | null>("plan_building_suggestions", null);
  

  const suggestions = useMemo(() => {
    let mergedSuggestions: SuggestionBase[] = [];

    if (cachedData && areSuggestionsValid(cachedData.timestamp)) {
      mergedSuggestions = [...cachedData.suggestions];
    }

    if (incomingSuggestions.length > 0) {
      incomingSuggestions.forEach((incomingSuggestion) => {
        const index = mergedSuggestions.findIndex(
          (s) => s.type === incomingSuggestion.type
        );
        if (index !== -1) {
          mergedSuggestions[index] = incomingSuggestion;
        } else {
          mergedSuggestions.push(incomingSuggestion);
        }
      });

      setCachedData({
        suggestions: mergedSuggestions,
        timestamp: Date.now(),
      });
    }

    return mergedSuggestions;
  }, [incomingSuggestions]);

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

  const allUserActivities: Array<{
    id: string;
    name: string;
    emoji?: string;
    measure: string;
  }> = useMemo(() => {
    const existentActivities = activities?.map((a) => ({
      id: a.id,
      name: a.title,
      emoji: a.emoji,
      measure: a.measure,
    })) ?? [];

    const suggestedActivities = activitiesSuggestion?.data.activities.map(
      (a) => ({
        id: a.id,
        name: a.name,
        emoji: a.emoji,
        measure: a.measure,
      })
    ) ?? [];
    return [...existentActivities, ...suggestedActivities];
  }, [activities, activitiesSuggestion]);

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
      suggestions.filter((s) => s.type === "plan_finishingDate").pop() as
        | PlanFinishingDateSuggestionData
        | undefined,
    [suggestions]
  );

  const isPlanComplete = Boolean(
    goalSuggestion &&
      activitiesSuggestion &&
      planTypeSuggestion &&
      (planTypeSuggestion.data.plan_type === "specific"
        ? sessionsSuggestion
        : true) &&
      milestonesSuggestion &&
      finishingDateSuggestion
  );

  const handleAccept = async () => {
    if (!isPlanComplete) return;

    try {
      await onPlanAccepted({
        goal: goalSuggestion!.data.goal,
        activities: activitiesSuggestion!.data.activities,
        planType: planTypeSuggestion!.data.plan_type,
        sessions: sessionsSuggestion!.data.sessions,
        milestones: milestonesSuggestion?.data.milestones.map((m) => ({
          description: m.description,
          date: new Date(m.date).toISOString(),
          progress: m.progress,
          criteria: m.criteria
            ?.filter((c) => "activityId" in c)
            .map((c) => ({
              activityId: (c as any).activityId,
              quantity: (c as any).quantity,
            })),
        })),
        finishingDate: finishingDateSuggestion?.data.finishingDate,
        createdAt: new Date().toISOString(),
      });
      setCachedData(null);
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

  if (!goalSuggestion) return null;

  return (
    <div className="max-h-[200px] overflow-y-auto flex flex-col gap-4 bg-white p-4 rounded-lg shadow-sm">
      {goalSuggestion && <PlanGoalSnippet goal={goalSuggestion.data.goal} />}

      {finishingDateSuggestion && (
        <PlanFinishingDateSnippet
          finishingDate={finishingDateSuggestion.data.finishingDate}
          explanation={finishingDateSuggestion.data.explanation}
        />
      )}

      {activitiesSuggestion && (
        <PlanActivitiesSnippet
          activities={activitiesSuggestion.data.activities}
        />
      )}

      {milestonesSuggestion && (
        <PlanMilestonesSnippet
          milestones={milestonesSuggestion.data.milestones.map((m) => ({
            description: m.description,
            date: new Date(m.date).toISOString(),
            progress: m.progress,
            criteria: m.criteria
              ?.filter((c) => "activityId" in c)
              .map((c) => ({
                activityId: (c as any).activityId,
                quantity: (c as any).quantity,
              })),
          }))}
          activities={allUserActivities}
        />
      )}

      {planTypeSuggestion && (
        <PlanTypeSnippet planType={planTypeSuggestion.data.plan_type} />
      )}

      {sessionsSuggestion && (
        <PlanSessionsSnippet
          sessions={sessionsSuggestion.data.sessions}
          activities={allUserActivities}
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
