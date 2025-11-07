import { ActivityCard } from "@/components/ActivityCard";
import ActivityEditor from "@/components/ActivityEditor";
import { ActivityLoggerPopover } from "@/components/ActivityLoggerPopover";
import ActivityPhotoUploader from "@/components/ActivityPhotoUploader";
import { MetricsLogPopover } from "@/components/MetricsLogPopover";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityLogData } from "@/contexts/activities/types";
import { useActivities } from "@/contexts/activities/useActivities";
import { useMetrics } from "@/contexts/metrics";
import { createFileRoute } from "@tanstack/react-router";
import type { Activity, ActivityEntry } from "@tsw/prisma";
import { Plus } from "lucide-react";
import { useCallback, useState } from "react";

export const Route = createFileRoute("/add")({
  component: LogPage,
});

function LogPage() {
  const { activities, activityEntries, isLoadingActivities } = useActivities();
  const { metrics } = useMetrics();

  const sortedActivities = [...activities].sort((a, b) => {
    const aEntryCount = activityEntries.filter(
      (entry: ActivityEntry) => entry.activityId === a.id
    ).length;
    const bEntryCount = activityEntries.filter(
      (entry: ActivityEntry) => entry.activityId === b.id
    ).length;
    return bEntryCount - aEntryCount;
  });

  const [selectedActivity, setSelectedActivity] = useState<
    Activity | undefined
  >();
  const [showPhotoUploader, setShowPhotoUploader] = useState(false);
  const [showActivityLogger, setShowActivityLogger] = useState(false);
  const [showMetricsPopover, setShowMetricsPopover] = useState(false);
  const [activityEditorOpen, setActivityEditorOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | undefined>(
    undefined
  );
  const [currentActivityLogData, setCurrentActivityLogData] =
    useState<ActivityLogData | null>(null);

  const handleActivityLogSubmit = useCallback(
    (data: ActivityLogData) => {
      if (!selectedActivity) return;

      setCurrentActivityLogData(data);
      setShowActivityLogger(false);
      setShowPhotoUploader(true);
    },
    [selectedActivity]
  );

  const handleActivitySelected = (activity: Activity) => {
    setSelectedActivity(activity);
    setShowActivityLogger(true);
    setShowPhotoUploader(false);
    setCurrentActivityLogData(null);
  };

  const handleAddActivity = () => {
    setActivityEditorOpen(true);
    setEditingActivity(undefined);
  };

  const handleEditActivity = (activity: Activity) => {
    setActivityEditorOpen(true);
    setEditingActivity(activity);
  };

  const handleActivityLoggedAndPhotoSkippedOrDone = () => {
    setShowPhotoUploader(false);
    setCurrentActivityLogData(null);

    // Show metrics popover if user has metrics configured
    if (metrics && metrics.length > 0) {
      setShowMetricsPopover(true);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 mb-16 relative max-w-2xl ">
      <h1 className="text-2xl font-bold">Log Activity</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 my-6">
        {isLoadingActivities ? (
          <>
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={`skeleton-${index}`} className="aspect-square" />
            ))}
          </>
        ) : (
          <>
            {sortedActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onClick={() => handleActivitySelected(activity)}
                onEditClick={() => handleEditActivity(activity)}
                selected={selectedActivity?.id === activity.id}
              />
            ))}
            <button
              onClick={handleAddActivity}
              className="flex flex-col items-left bg-input justify-center p-6 rounded-lg border-2 border-dashed border-border aspect-square hover:bg-input/80"
            >
              <Plus className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-xl font-medium text-left text-muted-foreground">
                Add New
              </span>
            </button>
          </>
        )}
      </div>
      <ActivityEditor
        open={activityEditorOpen}
        onClose={() => {
          setActivityEditorOpen(false);
        }}
        activity={editingActivity}
      />

      {selectedActivity && (
        <>
          {!showPhotoUploader && showActivityLogger && (
            <ActivityLoggerPopover
              open={true} // Visibility is controlled by showActivityLogger
              onClose={() => {
                setShowActivityLogger(false);
              }}
              selectedActivity={selectedActivity}
              onSubmit={handleActivityLogSubmit}
            />
          )}

          {showPhotoUploader && currentActivityLogData && (
            <ActivityPhotoUploader
              open={true} // Visibility is controlled by showPhotoUploader
              activityData={{
                activityId: selectedActivity!.id,
                datetime: currentActivityLogData.datetime,
                quantity: currentActivityLogData.quantity,
              }}
              onClose={() => {
                setShowPhotoUploader(false);
              }}
              onSuccess={handleActivityLoggedAndPhotoSkippedOrDone}
            />
          )}
        </>
      )}

      {/* Metrics Popover - shown after activity is logged */}
      <MetricsLogPopover
        open={showMetricsPopover}
        onClose={() => setShowMetricsPopover(false)}
        title={`How are you feeling after ${selectedActivity?.title}?`}
        description="This helps us identify patterns and correlations between your activities and how you feel throughout the day."
        customIcon={<span className="text-6xl">{selectedActivity?.emoji}</span>}
        showActivityWarning={false}
      />
    </div>
  );
}

export default LogPage;
