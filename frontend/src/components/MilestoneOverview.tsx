import { cn } from "@/lib/utils";
import { ApiPlan } from "@/contexts/UserPlanContext";
import { format, parseISO } from "date-fns";

interface MilestoneOverviewProps {
  milestones: ApiPlan['milestones'];
}

export function MilestoneOverview({ milestones }: MilestoneOverviewProps) {
  if (!milestones || milestones.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mt-4 mb-4">
      <div className="flex flex-row items-center justify-start gap-2">
        <span className="text-4xl">⛳️</span>
        <h2 className="text-xl font-semibold">Milestone Overview</h2>
      </div>
      <div className="ml-2 max-w-full h-[120px] flex flex-row gap-2 items-start flex-nowrap mt-7 overflow-x-auto">
        {milestones.map((milestone, index) => (
          <div
            key={index}
            className="flex flex-col items-center gap-2"
          >
            <div
              className={cn(
                "w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                "border-blue-300 scale-90 hover:scale-100 hover:border-blue-400",
                "group relative"
              )}
            >
              <span className="text-sm text-blue-500">{index + 1}</span>
              <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 w-48 bg-white border border-gray-200 rounded-md p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs text-center z-10">
                {milestone.description}
              </div>
            </div>
            <span className="text-xs text-gray-400 text-center">
              {milestone.description}<br/>
              {format(parseISO(milestone.date), 'MMM')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
} 