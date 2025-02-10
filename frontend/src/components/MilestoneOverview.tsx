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
    
    const orderedMilestones = milestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // First try to find the next uncompleted future milestone
    const nextFutureMilestone = orderedMilestones.find(m => 
      new Date(m.date) > now && calculateProgress(m) < 100
    );
    if (nextFutureMilestone) return nextFutureMilestone;

    // If no future uncompleted milestone, find the first uncompleted milestone
    const firstUncompletedMilestone = orderedMilestones.find(m => calculateProgress(m) < 100);
    if (firstUncompletedMilestone) return firstUncompletedMilestone;

    // If all are completed, return the last milestone
    const lastMilestone = orderedMilestones[orderedMilestones.length - 1];
    return lastMilestone;
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
      

      const range = {
        start: previousMilestone ? new Date(previousMilestone.date) : new Date(0),
        end: milestoneDate
      };
      
      return range;
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

    // Helper function to calculate progress for a group
    const calculateGroupProgress = (group: PlanMilestoneCriteriaGroup): number => {
      if (!group.criteria || group.criteria.length === 0) return 0;

      const progresses = group.criteria.map(criterion => 
        calculateMilestoneCriteriaProgress(criterion)
      );


      return group.junction === "AND" ? Math.min(...progresses) : Math.max(...progresses);
    };

    // Helper function to determine type and calculate progress accordingly
    const calculateMilestoneCriteriaProgress = (
      criterion: PlanMilestoneCriteria | PlanMilestoneCriteriaGroup
    ): number => {
      if ('activity_id' in criterion) {
        return calculateCriterionProgress(criterion);
      }
      if ('criteria' in criterion) {
        return calculateGroupProgress(criterion);
      }
      return 0;
    };


    // Calculate progress for each criterion and use AND logic (minimum) for the overall progress
    return Math.min(...milestone.criteria.map(calculateMilestoneCriteriaProgress));
  };

  const milestone = getNextMilestone();
  const progress = calculateProgress(milestone);
  const isComplete = progress >= 100;

  // Helper function to recursively render criteria and groups
  const renderCriteriaOrGroup = (criterionOrGroup: PlanMilestoneCriteria | PlanMilestoneCriteriaGroup, level = 0) => {
    if ('activity_id' in criterionOrGroup) {
      const activity = userData?.activities?.find(a => a.id === criterionOrGroup.activity_id);
      if (!activity) return null;

      return (
        <div className="text-sm text-gray-600" style={{ marginLeft: `${level * 16}px` }}>
          {activity.emoji} {criterionOrGroup.quantity} {activity.measure} of {activity.title}
        </div>
      );
    }

    if ('criteria' in criterionOrGroup) {
      return (
        <div style={{ marginLeft: `${level * 16}px` }}>
          <div className="text-sm font-medium text-gray-700">
            {criterionOrGroup.junction === "AND" ? "All of:" : "Any of:"}
          </div>
          <div className="space-y-1">
            {criterionOrGroup.criteria.map((c, i) => (
              <div key={i}>{renderCriteriaOrGroup(c, level + 1)}</div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

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
          {milestone.criteria?.map((criterion, index) => (
            <div key={index}>{renderCriteriaOrGroup(criterion)}</div>
          ))}
        </div>
      </div>
    </div>
  );
} 