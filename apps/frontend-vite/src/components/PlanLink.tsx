import { useThemeColors } from "@/hooks/useThemeColors";
import { useNavigate } from "@tanstack/react-router";
import { Target, ArrowRight, Calendar, CheckCircle2, Info } from "lucide-react";
import { useState, useMemo } from "react";
import AppleLikePopover from "./AppleLikePopover";
import { Button } from "./ui/button";
import { usePlans } from "@/contexts/plans";
import { useActivities } from "@/contexts/activities/useActivities";
import { cn } from "@/lib/utils";
import { format, isSameDay, startOfDay, addDays } from "date-fns";

interface PlanLinkProps {
  planId: string;
  displayText: string;
  emoji?: string;
  className?: string;
  labelClassName?: string;
}

export function PlanLink({
  planId,
  displayText,
  emoji,
  className,
  labelClassName,
}: PlanLinkProps) {
  const navigate = useNavigate();
  const themeColors = useThemeColors();
  const { plans } = usePlans();
  const { activityEntries } = useActivities();
  const [showPreview, setShowPreview] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);

  const plan = useMemo(() => plans?.find((p) => p.id === planId), [plans, planId]);
  const displayStartsWithEmoji = Boolean(
    emoji && displayText.trim().startsWith(emoji)
  );

  // Get upcoming sessions (next 7 days)
  const upcomingSessions = useMemo(() => {
    if (!plan?.sessions) return [];
    const today = startOfDay(new Date());
    const nextWeek = addDays(today, 7);
    return plan.sessions
      .filter((s) => {
        const sessionDate = new Date(s.date);
        return sessionDate >= today && sessionDate <= nextWeek;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 4);
  }, [plan?.sessions]);

  const upcomingQuantityByActivity = useMemo(() => {
    const totals = new Map<string, number>();
    for (const session of upcomingSessions) {
      totals.set(
        session.activityId,
        (totals.get(session.activityId) || 0) + (session.quantity || 0)
      );
    }
    return totals;
  }, [upcomingSessions]);

  // Get activity info for a session
  const getActivityForSession = (activityId: string) => {
    return plan?.activities?.find((a) => a.id === activityId);
  };

  // Check if session is completed (has activity entry on that day)
  const isSessionCompleted = (session: { date: Date | string; activityId: string }) => {
    if (!activityEntries) return false;
    return activityEntries.some(
      (entry) =>
        entry.activityId === session.activityId &&
        isSameDay(new Date(entry.datetime), new Date(session.date))
    );
  };

  const stopPlanLinkPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const handleClick = (e: React.MouseEvent) => {
    stopPlanLinkPropagation(e);
    setShowPreview(true);
  };

  const handleClosePreview = () => {
    setSelectedSession(null);
    setShowPreview(false);
  };

  const handleViewFullPlan = () => {
    handleClosePreview();
    navigate({ to: "/plans", search: { selectedPlan: planId } });
  };

  return (
    <>
      <span
        className={cn(
          `inline-flex items-center gap-1.5 font-medium cursor-pointer rounded-md px-2 py-0.5 transition-all text-foreground/90 ${themeColors.fadedBg} hover:${themeColors.bg}`,
          className
        )}
        onPointerDown={stopPlanLinkPropagation}
        onMouseDown={stopPlanLinkPropagation}
        onTouchStart={stopPlanLinkPropagation}
        onClick={handleClick}
      >
        {emoji && !displayStartsWithEmoji ? (
          <span className="text-base leading-none">{emoji}</span>
        ) : !emoji ? (
          <Target size={14} className="flex-shrink-0" />
        ) : null}
        <span className={labelClassName}>{displayText}</span>
      </span>

      <AppleLikePopover
        open={showPreview}
        onClose={handleClosePreview}
        title="Plan Preview"
        wrapperClassName="contents"
      >
        <div className="p-4 space-y-4">
          {/* Plan Header */}
          <div className="flex items-center gap-3">
            <span className="text-3xl">{emoji || "📋"}</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-lg">{plan?.goal || displayText}</h3>
              {plan?.activities && (
                <p className="text-sm text-muted-foreground">
                  {plan.activities.length} {plan.activities.length === 1 ? "activity" : "activities"}
                </p>
              )}
            </div>
          </div>

          {/* Activities */}
          {plan?.activities && plan.activities.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Activities</h4>
              <div className="flex flex-wrap gap-2">
                {plan.activities.slice(0, 6).map((activity) => {
                  const upcomingQuantity = upcomingQuantityByActivity.get(activity.id);
                  return (
                    <div
                      key={activity.id}
                      className="flex max-w-full items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-sm"
                    >
                      <span>{activity.emoji || "📌"}</span>
                      <span className="min-w-0 truncate text-foreground/80">{activity.title}</span>
                      {upcomingQuantity ? (
                        <span className="flex-shrink-0 text-xs text-muted-foreground">
                          · {upcomingQuantity} {activity.measure}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
                {plan.activities.length > 6 && (
                  <div className="flex items-center px-2.5 py-1.5 rounded-lg bg-muted text-sm text-muted-foreground">
                    +{plan.activities.length - 6} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upcoming Sessions */}
          {upcomingSessions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Calendar size={14} />
                Upcoming this week
              </h4>
              <div className="space-y-1.5">
                {upcomingSessions.map((session) => {
                  const activity = getActivityForSession(session.activityId);
                  const isCompleted = isSessionCompleted(session);
                  const isToday = isSameDay(new Date(session.date), new Date());
                  const quantityLabel =
                    session.quantity && activity?.measure
                      ? `${session.quantity} ${activity.measure}`
                      : session.quantity
                        ? `${session.quantity}`
                        : null;
                  const hasDescription = Boolean(session.descriptiveGuide?.trim());
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => hasDescription && setSelectedSession(session)}
                      disabled={!hasDescription}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        isCompleted ? "bg-green-500/10" : "bg-muted/50"
                      } ${hasDescription ? "hover:bg-muted cursor-pointer" : "cursor-default"}`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                      ) : (
                        <span className="text-base leading-none">{activity?.emoji || "📌"}</span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate ${isCompleted ? "text-muted-foreground line-through" : "text-foreground/80"}`}>
                          {activity?.title || "Activity"}
                        </span>
                        {quantityLabel && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {quantityLabel}
                          </span>
                        )}
                      </span>
                      {hasDescription && (
                        <Info size={13} className="flex-shrink-0 text-muted-foreground" />
                      )}
                      <span className={`text-xs ${isToday ? "text-primary font-medium" : "text-muted-foreground"}`}>
                        {isToday ? "Today" : format(new Date(session.date), "EEE")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* CTA */}
          <Button
            onClick={handleViewFullPlan}
            className="w-full gap-2"
          >
            View full plan
            <ArrowRight size={16} />
          </Button>
        </div>
      </AppleLikePopover>

      <AppleLikePopover
        open={Boolean(selectedSession)}
        onClose={() => setSelectedSession(null)}
        title="Session details"
        wrapperClassName="contents"
      >
        {selectedSession && (
          <div className="space-y-4 p-4">
            {(() => {
              const activity = getActivityForSession(selectedSession.activityId);
              const quantityLabel =
                selectedSession.quantity && activity?.measure
                  ? `${selectedSession.quantity} ${activity.measure}`
                  : selectedSession.quantity
                    ? `${selectedSession.quantity}`
                    : null;

              return (
                <>
                  <div className="flex items-start gap-3">
                    <span className="text-3xl leading-none">{activity?.emoji || "📌"}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-foreground">
                        {activity?.title || "Activity"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(selectedSession.date), "EEEE, MMM d")}
                        {quantityLabel ? ` · ${quantityLabel}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-muted/60 p-3 text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap">
                    {selectedSession.descriptiveGuide}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </AppleLikePopover>
    </>
  );
}
