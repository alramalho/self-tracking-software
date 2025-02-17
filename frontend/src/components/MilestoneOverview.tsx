import { cn } from "@/lib/utils";
import {
  PlanMilestone,
  PlanMilestoneCriteria,
  PlanMilestoneCriteriaGroup,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { useApiWithAuth } from "@/api";
import { Loader2, Minus, Plus, Pencil } from "lucide-react";
import { useEffect, useCallback, useState } from "react";
import { Button } from "./ui/button";
import { toast } from "react-hot-toast";

interface MilestoneProgress {
  milestone_id: string;
  description: string;
  date: string;
  progress: number;
  is_completed: boolean;
  criteria_progress: Array<{
    type: "criterion" | "group";
    activity_id?: string;
    quantity?: number;
    current_quantity?: number;
    progress: number;
    junction?: "AND" | "OR";
    criteria_progress?: Array<any>;
  }>;
}

interface NextMilestoneResponse {
  plan_id: string;
  next_milestone: MilestoneProgress | null;
}

interface MilestoneOverviewProps {
  planId: string;
  milestones: PlanMilestone[];
  onEdit?: () => void;
}

export function MilestoneOverview({
  planId,
  milestones,
  onEdit,
}: MilestoneOverviewProps) {
  const { useCurrentUserDataQuery } = useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const api = useApiWithAuth();
  const [optimisticProgress, setOptimisticProgress] = useState<number | null>(
    null
  );

  const {
    data: milestoneResponse,
    isLoading,
    refetch,
  } = useQuery<NextMilestoneResponse>({
    queryKey: ["milestoneProgress", planId],
    queryFn: async () => {
      const response = await api.get(
        `/calculate-plan-milestone-progress/${planId}`
      );
      return response.data;
    },
    enabled: !!planId && milestones?.length > 0,
  });

  const updateProgress = async (newProgress: number) => {
    const toastId = toast.loading("Saving progress...");
    const nextMilestone = milestoneResponse?.next_milestone;
    if (!nextMilestone) {
      toast.dismiss(toastId);
      return;
    }

    try {
      const milestone = milestones.find(
        (m) =>
          m.description === nextMilestone.description &&
          format(new Date(m.date), "yyyy-MM-dd") ===
            format(new Date(nextMilestone.date), "yyyy-MM-dd")
      );

      if (milestone) {
        milestone.progress = newProgress;
        await api.post(`/plans/${planId}/update`, {
          data: { milestones },
        });
        await currentUserDataQuery.refetch();
        toast.success("Progress saved", { id: toastId });
        await refetch();
      }
    } catch (error) {
      toast.error("Failed to save progress", { id: toastId });
      await refetch();
      setOptimisticProgress(null);
    }
  };

  // Refetch milestone progress when userData changes
  useEffect(() => {
    refetch();
  }, [userData, refetch]);

  if (!milestones || milestones.length === 0) return null;
  if (isLoading)
    return (
      <div className="flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  if (!milestoneResponse?.next_milestone) return null;

  const nextMilestone = milestoneResponse.next_milestone;
  const milestone = milestones.find(
    (m) =>
      m.description === nextMilestone.description &&
      format(new Date(m.date), "yyyy-MM-dd") ===
        format(new Date(nextMilestone.date), "yyyy-MM-dd")
  );
  const serverProgress =
    nextMilestone.criteria_progress?.length > 0
      ? nextMilestone.progress
      : milestone?.progress ?? 0;
  const progress = optimisticProgress ?? serverProgress;
  const isComplete = nextMilestone.is_completed || progress >= 100;
  const isManualProgress = !nextMilestone.criteria_progress?.length;

  const handleProgressChange = (increment: boolean) => {
    const step = 10;
    const newProgress = Math.min(
      Math.max(progress + (increment ? step : -step), 0),
      100
    );
    if (newProgress !== progress) {
      setOptimisticProgress(newProgress);
    }
  };

  const handleSave = () => {
    if (optimisticProgress !== null) {
      updateProgress(optimisticProgress);
    }
  };

  // Helper function to recursively render criteria and groups
  const renderCriteriaOrGroup = (criterionProgress: any, level = 0) => {
    if (criterionProgress.type === "criterion") {
      const activity = userData?.activities?.find(
        (a) => a.id === criterionProgress.activity_id
      );
      if (!activity) return null;

      return (
        <div
          className="text-sm text-gray-600"
          style={{ marginLeft: `${level * 16}px` }}
        >
          {activity.emoji} {criterionProgress.quantity} {activity.measure} of{" "}
          {activity.title}
          {criterionProgress.current_quantity > 0 &&
            ` (${criterionProgress.current_quantity} done)`}
        </div>
      );
    }

    if (criterionProgress.type === "group") {
      return (
        <div style={{ marginLeft: `${level * 16}px` }}>
          <div className="text-sm font-medium text-gray-700">
            {criterionProgress.junction === "AND" ? "All of:" : "Any of:"}
          </div>
          <div className="space-y-1">
            {criterionProgress.criteria_progress.map((c: any, i: number) => (
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
      <div className="flex flex-row items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-4xl">⛳️</span>
          <h2 className="text-xl font-semibold mt-2">Next Milestone</h2>
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
              {nextMilestone.description || "Untitled Milestone"}
            </h3>
            <p className="text-sm text-gray-500">
              Due {format(new Date(nextMilestone.date), "MMM d, yyyy")}
            </p>
          </div>
          <span className="text-4xl">
            {nextMilestone.criteria_progress?.[0]?.activity_id
              ? userData?.activities?.find(
                  (a) => a.id === nextMilestone.criteria_progress[0].activity_id
                )?.emoji
              : "📍"}
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
          {isManualProgress && (
            <div className="flex items-center justify-between gap-3 mt-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleProgressChange(false)}
                className="h-8 w-8 rounded-full"
                disabled={progress <= 0}
              >
                <Minus className="h-4 w-4" />
              </Button>
              {optimisticProgress !== null && optimisticProgress !== serverProgress && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                  className="px-3 h-8 text-xs font-medium"
                >
                  Save Changes
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleProgressChange(true)}
                disabled={progress >= 100}
                className="h-8 w-8 rounded-full"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {nextMilestone.criteria_progress?.length > 0 && (
          <div className="space-y-2">
            {nextMilestone.criteria_progress?.map(
              (criterion: any, index: number) => (
                <div key={index}>{renderCriteriaOrGroup(criterion)}</div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
