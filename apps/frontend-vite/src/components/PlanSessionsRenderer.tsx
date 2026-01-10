import { type CompletePlan } from "@/contexts/plans";
import { cn } from "@/lib/utils";
import { type Activity, type ActivityEntry, type PlanSession } from "@tsw/prisma";
import { format, isSameWeek, startOfWeek, isSameDay } from "date-fns";
import { ChevronDown, ChevronUp, Info, Pause, X } from "lucide-react";
import React, { useMemo, useState } from "react";
import AppleLikePopover from "./AppleLikePopover";
import BaseHeatmapRenderer from "./BaseHeatmapRenderer";
import { AnimatePresence, motion } from "framer-motion";

interface PlanSessionsRendererProps {
  plan: CompletePlan;
  activities: Activity[];
  activityEntries?: ActivityEntry[];
  startDate?: Date;
  endDate?: Date;
}

const PlanSessionsRenderer: React.FC<PlanSessionsRendererProps> = ({
  plan,
  activities,
  activityEntries = [],
  startDate,
  endDate,
}) => {
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [showPauseReasonDialog, setShowPauseReasonDialog] = useState(false);

  const isPaused = (plan as any).isPaused;
  const pauseReason = (plan as any).pauseReason;
  const pauseHistory = (plan as any).pauseHistory as Array<{ pausedAt: string; resumedAt?: string; reason?: string }> | null;

  const isWeekCompleted = (startDate: Date) =>
    plan.progress.weeks?.find((week) => isSameWeek(week.startDate, startDate))
      ?.isCompleted ?? false;

  const planSessions = plan.sessions || [];

  const beginningOfWeekOfFirstSession = useMemo(() => {
    if (planSessions.length === 0) return new Date();
    const sortedSessions = [...planSessions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const firstSession = sortedSessions[0];
    return startOfWeek(new Date(firstSession.date));
  }, [planSessions]);

  const getDefaultStartDate = () => {
    if (startDate) return startDate;
    if (planSessions.length === 0) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return sevenDaysAgo;
    }
    return beginningOfWeekOfFirstSession;
  };

  const formatSessionsForHeatMap = () => {
    return planSessions.map((session) => ({
      date: format(new Date(session.date), "yyyy/MM/dd"),
      count: session.quantity,
    }));
  };

  const getIntensityForDate = (dateStr: string) => {
    const sessionsOnDate = planSessions.filter(
      (s) => format(new Date(s.date), "yyyy-MM-dd") === dateStr
    );

    if (sessionsOnDate.length === 0) return null;

    const intensities = sessionsOnDate.map((session) => {
      const activityIndex = plan.activities.findIndex(
        (a) => a.id === session.activityId
      );

      const quantities = planSessions
        .filter((s) => s.activityId === session.activityId)
        .map((s) => s.quantity);
      const minQuantity = Math.min(...quantities);
      const maxQuantity = Math.max(...quantities);
      const intensityLevels = 5;
      const intensityStep =
        Math.max(maxQuantity - minQuantity, 1) / intensityLevels;

      const intensity = Math.min(
        Math.floor((session.quantity - minQuantity) / intensityStep),
        intensityLevels - 1
      );

      return { activityIndex, intensity };
    });

    return intensities;
  };

  const getSessionsForDate = (date: Date): PlanSession[] => {
    return planSessions.filter((session) =>
      isSameDay(new Date(session.date), date)
    );
  };

  const isSessionCompleted = (session: PlanSession): boolean => {
    return activityEntries.some(
      (entry) =>
        entry.activityId === session.activityId &&
        isSameDay(new Date(entry.datetime), new Date(session.date))
    );
  };

  const renderSessionViewer = () => {
    if (!focusedDate) return null;

    const sessionsOnDate = getSessionsForDate(focusedDate);

    return (
      <div className="p-4 bg-muted/70 backdrop-blur-sm rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-left">
            Sessions on {format(focusedDate, "MMMM d, yyyy")}
          </h3>
          <button
            onClick={() => setFocusedDate(null)}
            className="p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        {sessionsOnDate.length === 0 ? (
          <p className="text-center text-muted-foreground">
            No sessions planned for this date.
          </p>
        ) : (
          <ul className="list-none space-y-3">
            {sessionsOnDate.map((session, index) => {
              const activity = activities.find(
                (a) => a.id === session.activityId
              );
              if (!activity) return null;

              const isExpanded = expandedSessionId === session.id;
              const completed = isSessionCompleted(session);
              const hasDescription = session.descriptiveGuide && session.descriptiveGuide.trim() !== "";
              const hasImages = session.imageUrls && session.imageUrls.length > 0;
              const hasExpandableContent = hasDescription || hasImages;

              return (
                <li
                  key={session.id || index}
                  className={cn(
                    "rounded-lg bg-background/50 p-3 transition-all",
                    hasExpandableContent && "cursor-pointer hover:bg-background/70"
                  )}
                  onClick={() => {
                    if (hasExpandableContent) {
                      setExpandedSessionId(isExpanded ? null : session.id);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{activity.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-md font-medium">{activity.title}</span>
                        {completed && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                            Done
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {session.quantity} {activity.measure}
                      </span>
                    </div>
                    {hasExpandableContent && (
                      <div className="text-muted-foreground">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </div>
                    )}
                  </div>

                  <AnimatePresence>
                    {isExpanded && hasExpandableContent && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 pt-3 border-t border-border/50">
                          {hasDescription && (
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {session.descriptiveGuide}
                            </p>
                          )}
                          {hasImages && (
                            <div className={cn("grid gap-2", hasDescription && "mt-3")}>
                              {session.imageUrls.length === 1 ? (
                                <img
                                  src={session.imageUrls[0]}
                                  alt="Session reference"
                                  className="w-full h-auto rounded-lg object-cover max-h-48"
                                />
                              ) : (
                                <div className="grid grid-cols-2 gap-2">
                                  {session.imageUrls.map((url, imgIndex) => (
                                    <img
                                      key={imgIndex}
                                      src={url}
                                      alt={`Session reference ${imgIndex + 1}`}
                                      className="w-full h-24 rounded-lg object-cover"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="px-0">
      {/* Pause indicator banner */}
      {isPaused && (
        <div className="flex items-center justify-between gap-3 p-3 mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
          <div className="flex items-center gap-2">
            <Pause className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <span className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
              Plan is paused
            </span>
            {pauseReason && (
              <button
                onClick={() => setShowPauseReasonDialog(true)}
                className="p-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
              >
                <Info className="h-4 w-4" />
              </button>
            )}
          </div>
          <span className="text-xs text-yellow-600 dark:text-yellow-400">
            Streaks still count down
          </span>
        </div>
      )}

      <div className="flex justify-center mb-4">{renderSessionViewer()}</div>

      <BaseHeatmapRenderer
        activities={plan.activities}
        startDate={getDefaultStartDate()}
        endDate={endDate || (plan.finishingDate ? new Date(plan.finishingDate) : undefined)}
        heatmapData={formatSessionsForHeatMap()}
        onDateClick={setFocusedDate}
        getIntensityForDate={getIntensityForDate}
        getWeekCompletionStatus={(weekStartDate: Date) =>
          isWeekCompleted(weekStartDate)
        }
        uniqueId={`sessions-${plan.id}`}
        pauseHistory={pauseHistory}
      />

      {/* Pause reason dialog */}
      <AppleLikePopover
        open={showPauseReasonDialog}
        onClose={() => setShowPauseReasonDialog(false)}
        title="Pause Reason"
      >
        <div className="p-4">
          {pauseReason ? (
            <p className="text-foreground">{pauseReason}</p>
          ) : pauseHistory && pauseHistory.length > 0 ? (
            <div className="space-y-4">
              {pauseHistory.map((pause, index) => (
                <div key={index} className="border-b border-border pb-3 last:border-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <span>{format(new Date(pause.pausedAt), "MMM d, yyyy")}</span>
                    {pause.resumedAt && (
                      <>
                        <span>→</span>
                        <span>{format(new Date(pause.resumedAt), "MMM d, yyyy")}</span>
                      </>
                    )}
                  </div>
                  <p className="text-foreground">{pause.reason || "No reason provided"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No pause reason provided.</p>
          )}
        </div>
      </AppleLikePopover>
    </div>
  );
};

export default PlanSessionsRenderer;