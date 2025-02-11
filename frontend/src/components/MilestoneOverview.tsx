import { cn } from "@/lib/utils";
import { PlanMilestone, PlanMilestoneCriteria, PlanMilestoneCriteriaGroup, useUserPlan } from "@/contexts/UserPlanContext";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { useApiWithAuth } from "@/api";
import { Loader2 } from "lucide-react";

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
}

export function MilestoneOverview({ planId, milestones }: MilestoneOverviewProps) {
  const { useCurrentUserDataQuery } = useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();
  const api = useApiWithAuth();

  const { data: milestoneResponse, isLoading } = useQuery<NextMilestoneResponse>({
    queryKey: ['milestoneProgress', planId],
    queryFn: async () => {
      const response = await api.get(`/calculate-plan-milestone-progress/${planId}`);
      return response.data;
    },
    enabled: !!planId && milestones?.length > 0,
  });

  if (!milestones || milestones.length === 0) return null;
  if (isLoading) return <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!milestoneResponse?.next_milestone) return null;

  const nextMilestone = milestoneResponse.next_milestone;
  const progress = nextMilestone.progress;
  const isComplete = nextMilestone.is_completed;

  // Helper function to recursively render criteria and groups
  const renderCriteriaOrGroup = (criterionProgress: any, level = 0) => {
    if (criterionProgress.type === 'criterion') {
      const activity = userData?.activities?.find(a => a.id === criterionProgress.activity_id);
      if (!activity) return null;

      return (
        <div className="text-sm text-gray-600" style={{ marginLeft: `${level * 16}px` }}>
          {activity.emoji} {criterionProgress.quantity} {activity.measure} of {activity.title}
          {criterionProgress.current_quantity > 0 && ` (${criterionProgress.current_quantity} done)`}
        </div>
      );
    }

    if (criterionProgress.type === 'group') {
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
      <div className="flex flex-row items-center justify-start gap-2 mb-4">
        <span className="text-4xl">⛳️</span>
        <h2 className="text-xl font-semibold mt-2">Next Milestone</h2>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <h3 className="text-lg font-semibold">{nextMilestone.description || 'Untitled Milestone'}</h3>
            <p className="text-sm text-gray-500">
              Due {format(new Date(nextMilestone.date), 'MMM d, yyyy')}
            </p>
          </div>
          <span className="text-4xl">
            {nextMilestone.criteria_progress?.[0]?.activity_id 
              ? userData?.activities?.find(a => a.id === nextMilestone.criteria_progress[0].activity_id)?.emoji 
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
          {nextMilestone.criteria_progress?.map((criterion: any, index: number) => (
            <div key={index}>{renderCriteriaOrGroup(criterion)}</div>
          ))}
        </div>
      </div>
    </div>
  );
} 