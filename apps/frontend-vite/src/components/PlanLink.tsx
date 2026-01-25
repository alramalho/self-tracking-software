import { useThemeColors } from "@/hooks/useThemeColors";
import { useNavigate } from "@tanstack/react-router";
import { Target, ArrowRight, Calendar, CheckCircle2 } from "lucide-react";
import { useState, useMemo } from "react";
import AppleLikePopover from "./AppleLikePopover";
import { Button } from "./ui/button";
import { usePlans } from "@/contexts/plans";
import { useActivities } from "@/contexts/activities/useActivities";
import { format, isSameDay, startOfDay, addDays } from "date-fns";

interface PlanLinkProps {
  planId: string;
  displayText: string;
  emoji?: string;
}

export function PlanLink({ planId, displayText, emoji }: PlanLinkProps) {
  const navigate = useNavigate();
  const themeColors = useThemeColors();
  const { plans } = usePlans();
  const { activityEntries } = useActivities();
  const [showPreview, setShowPreview] = useState(false);

  const plan = useMemo(() => plans?.find((p) => p.id === planId), [plans, planId]);

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

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPreview(true);
  };

  const handleViewFullPlan = () => {
    setShowPreview(false);
    navigate({ to: "/plans", search: { selectedPlan: planId } });
  };

  return (
    <>
      <span
        className={`inline-flex items-center gap-1.5 font-medium cursor-pointer rounded-md px-2 py-0.5 transition-all text-foreground/90 ${themeColors.fadedBg} hover:${themeColors.bg}`}
        onClick={handleClick}
      >
        {emoji ? (
          <span className="text-base leading-none">{emoji}</span>
        ) : (
          <Target size={14} className="flex-shrink-0" />
        )}
        <span>{displayText}</span>
      </span>

      <AppleLikePopover
        open={showPreview}
        onClose={() => setShowPreview(false)}
        title="Plan Preview"
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
                {plan.activities.slice(0, 6).map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted text-sm"
                  >
                    <span>{activity.emoji || "📌"}</span>
                    <span className="text-foreground/80">{activity.title}</span>
                  </div>
                ))}
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
                  return (
                    <div
                      key={session.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                        isCompleted ? "bg-green-500/10" : "bg-muted/50"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                      ) : (
                        <span className="text-base leading-none">{activity?.emoji || "📌"}</span>
                      )}
                      <span className={`flex-1 ${isCompleted ? "text-muted-foreground line-through" : "text-foreground/80"}`}>
                        {activity?.title || "Activity"}
                      </span>
                      <span className={`text-xs ${isToday ? "text-primary font-medium" : "text-muted-foreground"}`}>
                        {isToday ? "Today" : format(new Date(session.date), "EEE")}
                      </span>
                    </div>
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
    </>
  );
}
