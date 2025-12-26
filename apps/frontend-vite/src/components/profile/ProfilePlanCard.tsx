import PlanActivityEntriesRenderer from "@/components/PlanActivityEntriesRenderer";
import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
import { Medal, Pencil, Sprout } from "lucide-react";
import { type Activity, type ActivityEntry } from "@tsw/prisma";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { type CompletePlan } from "@/contexts/plans";

interface ProfilePlanCardProps {
  plan: CompletePlan & {
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
  const navigate = useNavigate();

  // Check achievements from inline progress data
  const habitAchieved = plan.progress?.habitAchievement?.isAchieved ?? false;
  const lifestyleAchieved =
    plan.progress?.lifestyleAchievement?.isAchieved ?? false;

  // Determine shine color and gradient based on achievement
  const shineColor = lifestyleAchieved
    ? "#f59e0b" // amber-500
    : habitAchieved
    ? "#84cc16" // lime-500
    : null;

  const bgClass = lifestyleAchieved
    ? "bg-gradient-to-br from-card via-cardto-amber-50/80 dark:to-amber-900/40"
    : habitAchieved
    ? "bg-gradient-to-br from-card via-card to-green-50/80 dark:to-lime-900/40"
    : "bg-card";

  const shadowClass = lifestyleAchieved
    ? "shadow-lg shadow-amber-200/50 dark:shadow-amber-900/30"
    : habitAchieved
    ? "shadow-lg shadow-lime-200/50 dark:shadow-lime-900/30"
    : "shadow-none";

  return (
    <div className={cn("relative rounded-2xl bg-card", shadowClass, bgClass)}>
      {/* Shine border for achievements - positioned absolutely to wrap entire card */}
      {shineColor && (
        <div className="absolute inset-0 z-50 pointer-events-none">
          <ShineBorder
            shineColor={shineColor}
            borderWidth={2}
            duration={10}
            className="rounded-2xl"
          />
        </div>
      )}

      {/* Card content wrapper */}
      <div className="relative rounded-2xl border border-border overflow-hidden">
        {/* Background image section with gradient fade */}
        {plan.backgroundImageUrl && (
          <div className="relative h-32 w-full">
            <img
              src={plan.backgroundImageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Gradient overlay - fades from transparent to card background */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/60 to-card" />
          </div>
        )}

        {/* Card content */}
        <div
          className={cn(
            "p-4",
            plan.backgroundImageUrl ? "-mt-8" : "mt-3",
            !plan.backgroundImageUrl && bgClass
          )}
        >
          {/* Header section - emphasized when background image is present */}
          <div
            className={cn(
              "flex flex-row items-center gap-2 mb-2 relative z-10",
              plan.backgroundImageUrl
            )}
          >
            <span className="text-5xl">{plan.emoji}</span>
            <div className="flex flex-col gap-0 flex-1">
              <div className="flex flex-row items-center gap-2 flex-wrap">
                <h3
                  className={cn(
                    "text-lg font-semibold inline-flex items-center gap-3",
                    plan.backgroundImageUrl && "drop-shadow-sm"
                  )}
                >
                  {plan.goal}

                  <div className="flex items-center gap-1">
                    {/* Edit button - inline with title text */}
                    {isOwnProfile && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate({ to: "/edit-plan/$planId", params: { planId: plan.id! } })}
                        className="h-5 w-5 text-foreground/90 inline-flex"
                      >
                        <Pencil size={20} />
                      </Button>
                    )}

                    {/* Achievement badges - inline with title text */}
                    {lifestyleAchieved && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 cursor-pointer"
                        onClick={() => onBadgeClick("lifestyles")}
                      >
                        <Medal size={20} className="text-amber-500" />
                        <span className="text-sm font-medium text-amber-500">
                          Lifestyle
                        </span>
                      </span>
                    )}
                    {habitAchieved && !lifestyleAchieved && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-lime-100 dark:bg-lime-900/30 cursor-pointer"
                        onClick={() => onBadgeClick("habits")}
                      >
                        <Sprout size={20} className="text-lime-500" />
                        <span className="text-sm font-medium text-lime-500">
                          Habit
                        </span>
                      </span>
                    )}
                  </div>
                </h3>

                {plan.visibility === "PRIVATE" && isOwnProfile && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                    Private
                  </span>
                )}
              </div>
              {plan.outlineType == "TIMES_PER_WEEK" && (
                <span
                  className={cn(
                    "text-sm text-muted-foreground",
                    plan.backgroundImageUrl && "drop-shadow-sm"
                  )}
                >
                  {plan.timesPerWeek} times per week
                </span>
              )}
              {plan.outlineType == "SPECIFIC" && (
                <span
                  className={cn(
                    "text-sm text-muted-foreground",
                    plan.backgroundImageUrl && "drop-shadow-sm"
                  )}
                >
                  Custom plan
                </span>
              )}
            </div>
          </div>

          <PlanActivityEntriesRenderer
            plan={plan as any}
            activities={activities}
            activityEntries={activityEntries}
          />
        </div>
      </div>

    </div>
  );
}
