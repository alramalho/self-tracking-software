import { modifyManualMilestone } from "@/app/actions";
import { Progress } from "@/components/ui/progress";
import { useUserPlan } from "@/contexts/UserGlobalContext";
import { PlanMilestone } from "@tsw/prisma/types";
import { format } from "date-fns";
import { Minus, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

interface MilestoneOverviewProps {
  planId: string;
  milestones: PlanMilestone[];
  onEdit?: () => void;
}

interface CriterionProgress {
  activityId: string;
  quantity: number;
  currentQuantity: number;
  progress: number;
}

export function MilestoneOverview({
  planId,
  milestones,
  onEdit,
}: MilestoneOverviewProps) {
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const {data: userData} = currentUserDataQuery;
  const plan = userData?.plans.find(p => p.id === planId);
  const [optimisticProgress, setOptimisticProgress] = useState<number | null>(null);

  // Function to calculate automatic milestone progress
  const calculateAutoMilestoneProgress = useMemo(() => {
    return (milestone: PlanMilestone): { progress: number; criteriaProgress: CriterionProgress[] } => {
      if (!milestone.criteria || !milestone.criteria.items || !userData?.activityEntries) {
        return { progress: milestone.progress || 0, criteriaProgress: [] };
      }

      // Get milestone date range (from beginning of time to milestone date)
      const milestoneDate = new Date(milestone.date);
      const startDate = new Date(0);

      const criteriaProgress: CriterionProgress[] = milestone.criteria.items.map((item) => {
        // Find relevant activity entries for this criterion
        const relevantEntries = userData.activityEntries.filter(entry => {
          const entryDate = new Date(entry.date);
          return (
            entry.activityId === item.activityId &&
            entryDate >= startDate &&
            entryDate <= milestoneDate
          );
        });

        const currentQuantity = relevantEntries.reduce((sum, entry) => sum + entry.quantity, 0);
        const progress = Math.min(100, (currentQuantity / item.quantity) * 100);

        return {
          activityId: item.activityId,
          quantity: item.quantity,
          currentQuantity,
          progress,
        };
      });

      // Calculate overall progress based on junction type
      const overallProgress = criteriaProgress.length > 0 
        ? milestone.criteria.junction === "AND"
          ? Math.min(...criteriaProgress.map(c => c.progress))  // AND: all must be complete
          : Math.max(...criteriaProgress.map(c => c.progress))  // OR: any can be complete
        : milestone.progress || 0;

      return { progress: overallProgress, criteriaProgress };
    };
  }, [userData?.activityEntries]);

  // Find the current milestone (first non-completed one)
  const currentMilestone = useMemo(() => {
    if (!milestones?.length) return null;
    
    // Sort milestones by date
    const sortedMilestones = [...milestones].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Find first non-completed milestone (progress < 100)
    const nextMilestone = sortedMilestones.find(m => (m.progress || 0) < 100);
    
    // If all milestones are completed, return the last one
    return nextMilestone || sortedMilestones[sortedMilestones.length - 1];
  }, [milestones]);

  const handleProgressChange = async (delta: number) => {
    if (!currentMilestone) return;

    const toastId = toast.loading("Updating progress...");
    
    try {
      const result = await modifyManualMilestone(currentMilestone.id, delta);
      
      if (result.success) {
        toast.success("Progress updated", { id: toastId });
        await currentUserDataQuery.refetch(); // Refresh data
        setOptimisticProgress(null);
      } else {
        toast.error(result.error || "Failed to update progress", { id: toastId });
      }
    } catch (error) {
      toast.error("Failed to update progress", { id: toastId });
    }
  };

  // Calculate progress for the current milestone
  const milestoneCalculation = useMemo(() => {
    if (!currentMilestone) return null;
    
    const isManualMilestone = !currentMilestone.criteria;
    
    if (isManualMilestone) {
      return {
        progress: optimisticProgress ?? (currentMilestone.progress || 0),
        criteriaProgress: [],
        isManualMilestone: true,
      };
    } else {
      const autoCalc = calculateAutoMilestoneProgress(currentMilestone);
      return {
        progress: autoCalc.progress,
        criteriaProgress: autoCalc.criteriaProgress,
        isManualMilestone: false,
      };
    }
  }, [currentMilestone, optimisticProgress, calculateAutoMilestoneProgress]);

  if (!currentMilestone || !milestoneCalculation) return null;

  const { progress: currentProgress, criteriaProgress, isManualMilestone } = milestoneCalculation;
  const isComplete = currentProgress >= 100;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex flex-row items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-4xl">⛳️</span>
          <h2 className="text-xl font-semibold">Next Milestone</h2>
          {isManualMilestone ? (
            <Badge variant="outline" className="text-xs bg-yellow-200 text-yellow-800 border-yellow-800">
              Manual
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs bg-green-200 text-green-800 border-green-800">
              Automatic
            </Badge>
          )}
        </div>
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            className="h-8 w-8"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <h3 className="text-lg font-semibold">
              {currentMilestone.description || "Untitled Milestone"}
            </h3>
            <p className="text-sm text-gray-500">
              Due {format(new Date(currentMilestone.date), "MMM d, yyyy")}
            </p>
          </div>
          <span className="text-4xl">📍</span>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Progress</span>
            <span className="font-medium">{Math.round(currentProgress)}%</span>
          </div>
          <Progress
            value={currentProgress}
            className="h-2"
            indicatorColor={isComplete ? "bg-green-500" : "bg-blue-500"}
          />
          {isManualMilestone && (
            <div className="flex items-center justify-between gap-3 mt-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleProgressChange(-10)}
                className="h-8 w-8 rounded-full"
                disabled={currentProgress <= 0}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleProgressChange(10)}
                disabled={currentProgress >= 100}
                className="h-8 w-8 rounded-full"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {!isManualMilestone && criteriaProgress.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Criteria {currentMilestone.criteria?.junction ? `(${currentMilestone.criteria?.junction})` : ""}:</h4>
            {criteriaProgress.map((criterion, index) => {
              const activity = userData?.activities?.find(a => a.id === criterion.activityId);
              if (!activity) return null;

              return (
                <div key={index} className="text-sm text-gray-600 flex items-center justify-between">
                  <span>
                    {activity.emoji} {criterion.quantity} {activity.measure} of {activity.title}
                  </span>
                  <span className="text-xs text-gray-500">
                    {criterion.currentQuantity}/{criterion.quantity} ({Math.round(criterion.progress)}%)
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
