import PlanActivityEntriesRenderer from "@/components/PlanActivityEntriesRenderer";
import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
import { Medal, Sprout } from "lucide-react";
import { type Activity, type ActivityEntry } from "@tsw/prisma";

interface ProfilePlanCardProps {
  plan: {
    id: string;
    emoji: string | null;
    goal: string;
    visibility: string;
    outlineType: string;
    timesPerWeek?: number | null;
    finishingDate: Date | null;
    progress?: {
      habitAchievement?: { isAchieved: boolean } | null;
      lifestyleAchievement?: { isAchieved: boolean } | null;
    } | null;
  };
  activities: Activity[];
  activityEntries: ActivityEntry[];
  isOwnProfile: boolean;
  onBadgeClick: (badgeType: "habits" | "lifestyles" | null) => void;
}

export function ProfilePlanCard({
  plan,
  activities,
  activityEntries,
  isOwnProfile,
  onBadgeClick,
}: ProfilePlanCardProps) {
  // Check achievements from inline progress data
  const habitAchieved = plan.progress?.habitAchievement?.isAchieved ?? false;
  const lifestyleAchieved =
    plan.progress?.lifestyleAchievement?.isAchieved ?? false;

  // Determine shine color based on achievement
  const shineColor = lifestyleAchieved
    ? "#f59e0b" // amber-500
    : habitAchieved
    ? "#84cc16" // lime-500
    : null;

  return (
    <div className={cn("relative rounded-2xl bg-card border border-border p-4")}>
      {/* Shine border for achievements */}
      {shineColor && (
        <ShineBorder
          shineColor={shineColor}
          borderWidth={2}
          duration={10}
          className="rounded-2xl"
        />
      )}

      <div className="flex flex-row items-center gap-2 mb-2">
        <span className="text-4xl">{plan.emoji}</span>
        <div className="flex flex-col gap-0">
          <div className="flex flex-row items-center gap-2">
            <h3 className="text-lg font-semibold">{plan.goal}</h3>
            {plan.visibility === "PRIVATE" && isOwnProfile && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                Private
              </span>
            )}
          </div>
          {plan.outlineType == "TIMES_PER_WEEK" && (
            <span className="text-sm text-muted-foreground">
              {plan.timesPerWeek} times per week
            </span>
          )}
          {plan.outlineType == "SPECIFIC" && (
            <span className="text-sm text-muted-foreground">Custom plan</span>
          )}
        </div>
      </div>

      {/* Achievement displays */}
      <div
        className="space-y-2 mb-4 absolute top-2 right-2 flex flex-col gap-2 z-10"
        onClick={() =>
          onBadgeClick(
            lifestyleAchieved ? "lifestyles" : habitAchieved ? "habits" : null
          )
        }
      >
        {habitAchieved && (
          <div className="flex flex-row items-center gap-2">
            <Sprout size={42} className="text-lime-500 animate-pulse" />
          </div>
        )}
        {lifestyleAchieved && (
          <div className="flex flex-row items-center gap-2">
            <Medal size={42} className="text-amber-500 animate-pulse" />
          </div>
        )}
      </div>
      <PlanActivityEntriesRenderer
        plan={plan as any}
        activities={activities}
        activityEntries={activityEntries}
      />
    </div>
  );
}
