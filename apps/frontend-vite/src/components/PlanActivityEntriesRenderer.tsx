import { type CompletePlan } from "@/contexts/plans";
import { type Activity, type ActivityEntry } from "@tsw/prisma";
import { addWeeks, subWeeks, format, isSameWeek, startOfWeek, differenceInWeeks } from "date-fns";
import { Info, Pause } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import ActivityEditor from "./ActivityEditor";
import AppleLikePopover from "./AppleLikePopover";
import BaseHeatmapRenderer from "./BaseHeatmapRenderer";
interface PlanActivityEntriesRendererProps {
  plan: CompletePlan;
  activities: Activity[];
  activityEntries: ActivityEntry[];
  startDate?: Date;
  endDate?: Date;
  }

const PlanActivityEntriesRenderer: React.FC<
  PlanActivityEntriesRendererProps
> = ({ plan, activities, activityEntries, startDate, endDate}) => {
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [isActivityEditorOpen, setIsActivityEditorOpen] = useState(false);
  const [showPauseReasonDialog, setShowPauseReasonDialog] = useState(false);

  const isPaused = (plan as any).isPaused;
  const pauseReason = (plan as any).pauseReason;
  const pauseHistory = (plan as any).pauseHistory as Array<{ pausedAt: string; resumedAt?: string; reason?: string }> | null;
  const isWeekCompleted = (startDate: Date) => plan.progress.weeks?.find((week) =>
    isSameWeek(week.startDate, startDate)
  )?.isCompleted ?? false;

  const planActivityEntries = activityEntries.filter((e) =>
    e.activityId && plan.activities?.map((a) => a.id).includes(e.activityId)
  );

  const beginingOfWeekOfFirstActivityEntry = useMemo(() => {
    if (planActivityEntries.length === 0) return new Date();
    const sortedPlanActivityEntries = planActivityEntries.sort(
      (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
    );
    const firstActivityEntry = sortedPlanActivityEntries[0];
    const beginingOfWeek = startOfWeek(firstActivityEntry.datetime);
    return beginingOfWeek;
  }, [planActivityEntries]);

  useEffect(() => {}, [beginingOfWeekOfFirstActivityEntry]);

  const MINIMUM_WEEKS_TO_DISPLAY = 5; // ~1 month minimum
  const WEEKS_AFTER_TODAY = 1;

  const getDefaultStartDate = () => {
    if (startDate) return startDate;
    if (planActivityEntries.length === 0) {
      // For empty plans, show ~2 weeks before today so today appears roughly in the middle
      return subWeeks(new Date(), 2);
    }
    return beginingOfWeekOfFirstActivityEntry;
  };

  const getEndDate = () => {
    if (endDate) return endDate;
    const defaultStart = getDefaultStartDate();
    const oneWeekFromNow = addWeeks(new Date(), WEEKS_AFTER_TODAY);

    // Ensure minimum display period
    const weeksFromStartToEnd = differenceInWeeks(oneWeekFromNow, defaultStart);
    if (weeksFromStartToEnd < MINIMUM_WEEKS_TO_DISPLAY) {
      return addWeeks(defaultStart, MINIMUM_WEEKS_TO_DISPLAY);
    }

    return oneWeekFromNow;
  };

  const formatEntriesForHeatMap = () => {
    const formattedEntries = planActivityEntries.map((entry) => {
      return {
        date: format(entry.datetime, "yyyy/MM/dd"),
        count: entry.quantity,
      };
    });
    return formattedEntries;
  };

  const handleOpenActivityEditor = (activity: Activity) => {
    setEditingActivity(activity);
    setIsActivityEditorOpen(true);
  };

  const handleCloseActivityEditor = () => {
    setEditingActivity(null);
    setIsActivityEditorOpen(false);
  };

  const getIntensityForDate = (dateStr: string) => {
    const entriesOnDate = planActivityEntries.filter(
      (e) => format(e.datetime, "yyyy-MM-dd") === dateStr
    );

    if (entriesOnDate.length === 0) return null;

    const intensities = entriesOnDate.map((entry) => {
      const activityIndex = plan.activities.findIndex(
        (a) => a.id === entry.activityId
      );

      const quantities = planActivityEntries
        .filter((e) => e.activityId === entry.activityId)
        .map((e) => e.quantity);
      const minQuantity = Math.min(...quantities);
      const maxQuantity = Math.max(...quantities);
      const intensityLevels = 5;
      const intensityStep =
        Math.max(maxQuantity - minQuantity, 1) / intensityLevels;

      const intensity = Math.min(
        Math.floor((entry.quantity - minQuantity) / intensityStep),
        intensityLevels - 1
      );

      return { activityIndex, intensity };
    });

    return intensities;
  };

  const renderActivityViewer = () => {
    if (!focusedDate) return null;

    const entriesOnDate = planActivityEntries.filter(
      (entry) =>
        format(entry.datetime, "yyyy-MM-dd") === format(focusedDate, "yyyy-MM-dd")
    );

    return (
      <div className="p-4 bg-muted/70 backdrop-blur-sm rounded-xl w-full max-w-md">
        <h3 className="text-md font-semibold mb-4 text-left">
          Activities on {format(focusedDate, "MMMM d, yyyy")}
        </h3>
        {entriesOnDate.length === 0 ? (
          <p className="text-left text-sm text-muted-foreground">
            No activities recorded for this date.
          </p>
        ) : (
          <ul className="list-none space-y-4">
            {entriesOnDate.map((entry, index) => {
              const activity = activities.find(
                (a) => a.id === entry.activityId
              );
              if (!activity) return null;

              return (
                <li key={index} className="flex items-center gap-2">
                  <span className="text-3xl">{activity.emoji}</span>
                  <span className="text-md">{activity.title}</span>
                  <span className="text-sm mt-1 text-muted-foreground">
                    ({entry.quantity} {activity.measure})
                  </span>
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

      <div className="flex justify-center mb-4">{renderActivityViewer()}</div>

      <BaseHeatmapRenderer
        activities={plan.activities}
        startDate={getDefaultStartDate()}
        endDate={getEndDate()}
        heatmapData={formatEntriesForHeatMap()}
        onDateClick={setFocusedDate}
        getIntensityForDate={getIntensityForDate}
        getWeekCompletionStatus={(weekStartDate: Date) =>
          isWeekCompleted(weekStartDate)
        }
        onEditActivity={handleOpenActivityEditor}
        uniqueId={plan.id}
        pauseHistory={pauseHistory}
      />
      {editingActivity && (
        <ActivityEditor
          open={isActivityEditorOpen}
          onClose={handleCloseActivityEditor}
          activity={editingActivity}
        />
      )}

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

export default PlanActivityEntriesRenderer;
