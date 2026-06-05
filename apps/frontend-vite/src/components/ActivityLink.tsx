import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { useActivities } from "@/contexts/activities/useActivities";
import { usePlans } from "@/contexts/plans";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { Activity, ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";

interface ActivityLinkProps {
  activityId: string;
  displayText: string;
  emoji?: string | null;
  className?: string;
  labelClassName?: string;
}

export function ActivityLink({
  activityId,
  displayText,
  emoji,
  className,
  labelClassName,
}: ActivityLinkProps) {
  const navigate = useNavigate();
  const themeColors = useThemeColors();
  const { activities } = useActivities();
  const { plans } = usePlans();
  const [showPreview, setShowPreview] = useState(false);

  const activity = useMemo(
    () => activities?.find((item: any) => item.id === activityId),
    [activities, activityId]
  );
  const linkedPlans = useMemo(
    () =>
      (plans || []).filter((plan: any) =>
        plan.activities?.some((item: any) => item.id === activityId)
      ),
    [plans, activityId]
  );
  const resolvedEmoji = emoji || activity?.emoji || null;
  const resolvedLabel = displayText || activity?.title || "Activity";
  const displayStartsWithEmoji = Boolean(
    resolvedEmoji && resolvedLabel.trim().startsWith(resolvedEmoji)
  );

  const stopPropagation = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const handleViewPlan = () => {
    const firstPlan = linkedPlans[0];
    if (!firstPlan) return;
    setShowPreview(false);
    navigate({ to: "/plans", search: { selectedPlan: firstPlan.id } });
  };

  return (
    <>
      <span
        className={cn(
          `inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-0.5 align-baseline font-medium text-foreground/90 transition-all ${themeColors.fadedBg} hover:${themeColors.bg}`,
          className
        )}
        onPointerDown={stopPropagation}
        onMouseDown={stopPropagation}
        onTouchStart={stopPropagation}
        onClick={(event) => {
          stopPropagation(event);
          setShowPreview(true);
        }}
      >
        {resolvedEmoji && !displayStartsWithEmoji ? (
          <span className="text-base leading-none">{resolvedEmoji}</span>
        ) : !resolvedEmoji ? (
          <Activity size={14} className="flex-shrink-0" />
        ) : null}
        <span className={cn("min-w-0 truncate", labelClassName)}>
          {resolvedLabel}
        </span>
      </span>

      <AppleLikePopover
        open={showPreview}
        onClose={() => setShowPreview(false)}
        title="Activity"
        wrapperClassName="contents"
      >
        <div className="space-y-4 p-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none">{resolvedEmoji || "📌"}</span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-semibold text-foreground">
                {activity?.title || resolvedLabel}
              </h3>
              <p className="text-sm text-muted-foreground">
                {activity?.measure || "tracked activity"}
              </p>
            </div>
          </div>

          {linkedPlans.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                Part of
              </h4>
              <div className="space-y-1.5">
                {linkedPlans.slice(0, 3).map((plan: any) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => {
                      setShowPreview(false);
                      navigate({ to: "/plans", search: { selectedPlan: plan.id } });
                    }}
                    className="flex w-full items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <span>{plan.emoji || "🎯"}</span>
                    <span className="min-w-0 flex-1 truncate text-foreground/80">
                      {plan.goal}
                    </span>
                    <ArrowRight size={14} className="text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {linkedPlans.length > 0 && (
            <Button onClick={handleViewPlan} className="w-full gap-2">
              View plan
              <ArrowRight size={16} />
            </Button>
          )}
        </div>
      </AppleLikePopover>
    </>
  );
}
