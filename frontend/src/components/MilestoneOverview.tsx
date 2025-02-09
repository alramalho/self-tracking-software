import { cn } from "@/lib/utils";
import { PlanMilestone, PlanMilestoneCriteria, PlanMilestoneCriteriaGroup, useUserPlan } from "@/contexts/UserPlanContext";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";

interface MilestoneOverviewProps {
  milestones: PlanMilestone[];
}

export function MilestoneOverview({ milestones }: MilestoneOverviewProps) {
  const { useCurrentUserDataQuery } = useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();
  const activityEntries = userData?.activityEntries || [];

  if (!milestones || milestones.length === 0) return null;

  // Get the next milestone (first uncompleted future milestone, or first uncompleted milestone, or last milestone)
  const getNextMilestone = () => {
    const now = new Date();
    // First try to find the next uncompleted future milestone
    const nextFutureMilestone = milestones.find(m => 
      new Date(m.date) > now && calculateProgress(m) < 100
    );
    if (nextFutureMilestone) return nextFutureMilestone;

    // If no future uncompleted milestone, find the first uncompleted milestone
    const firstUncompletedMilestone = milestones.find(m => calculateProgress(m) < 100);
    if (firstUncompletedMilestone) return firstUncompletedMilestone;

    // If all are completed, return the last milestone
    return milestones[milestones.length - 1];
  };

  const calculateProgress = (milestone: PlanMilestone) => {
    if (!milestone.criteria) return 0;

    // Helper function to get the date range for a milestone
    const getMilestoneRange = (milestone: PlanMilestone): { start: Date; end: Date } => {
      const milestoneDate = new Date(milestone.date);
      // Find the previous milestone with the same activity
      const previousMilestone = milestones
        .filter(m => new Date(m.date) < milestoneDate)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      return {
        start: previousMilestone ? new Date(previousMilestone.date) : new Date(0),
        end: milestoneDate
      };
    };

    // Helper function to calculate progress for a single criterion
    const calculateCriterionProgress = (criterion: PlanMilestoneCriteria): number => {
      if (!criterion.activity_id) return 0;

      const { start, end } = getMilestoneRange(milestone);

      const relevantEntries = activityEntries.filter(entry => 
        entry.activity_id === criterion.activity_id &&
        new Date(entry.date) > start &&
        new Date(entry.date) <= end
      );

      const totalQuantity = relevantEntries.reduce((sum, entry) => sum + entry.quantity, 0);
      return Math.min(100, (totalQuantity / criterion.quantity) * 100);
    };

    // Helper function to calculate progress for a group of criteria
    const calculateGroupProgress = (
      criteria: (PlanMilestoneCriteria | PlanMilestoneCriteriaGroup)[],
      junction: "AND" | "OR" = "AND"
    ): number => {
      if (!criteria || criteria.length === 0) return 0;

      const progresses = criteria.map(criterion => {
        if ('activity_id' in criterion) {
          return calculateCriterionProgress(criterion);
        }
        if ('criteria' in criterion && criterion.criteria) {
          return calculateGroupProgress(criterion.criteria, criterion.junction);
        }
        return 0;
      });

      if (progresses.length === 0) return 0;

      if (junction === "AND") {
        return Math.min(...progresses);
      } else {
        return Math.max(...progresses);
      }
    };

    return calculateGroupProgress(milestone.criteria);
  };

  const milestone = getNextMilestone();
  const progress = calculateProgress(milestone);
  const isComplete = progress >= 100;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex flex-row items-center justify-start gap-2 mb-4">
        <span className="text-4xl">⛳️</span>
        <h2 className="text-xl font-semibold mt-2">Next Milestone</h2>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <h3 className="text-lg font-semibold">{milestone.description || 'Untitled Milestone'}</h3>
            <p className="text-sm text-gray-500">
              Due {format(new Date(milestone.date), 'MMM d, yyyy')}
            </p>
          </div>
          <span className="text-4xl">
            {milestone.criteria?.[0] && 'activity_id' in milestone.criteria[0] 
              ? userData?.activities?.find(a => a.id === (milestone.criteria[0] as PlanMilestoneCriteria).activity_id)?.emoji 
              : '📍'}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Progress</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress 
            value={progress} 
            className="h-2" 
            indicatorColor={isComplete ? "bg-green-500" : "bg-blue-500"}
          />
        </div>

        <div className="space-y-2">
          {milestone.criteria?.map((criterion, index) => {
            if ('activity_id' in criterion) {
              const activity = userData?.activities?.find(a => a.id === criterion.activity_id);
              if (!activity) return null;

              return (
                <div key={index} className="text-sm text-gray-600">
                  {activity.emoji} {criterion.quantity} {activity.measure} of {activity.title}
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
} 