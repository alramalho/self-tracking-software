import { ActivityCard } from "@/components/ActivityCard";
import ActivityEditor from "@/components/ActivityEditor";
import { ActivityLoggerPopover } from "@/components/ActivityLoggerPopover";
import ActivityPhotoUploader from "@/components/ActivityPhotoUploader";
import {
  DifficultyLogPopover,
  type DifficultyLevel,
} from "@/components/DifficultyLogPopover";
import { MetricsLogPopover } from "@/components/MetricsLogPopover";
import SharedActivityPrompt from "@/components/SharedActivityPrompt";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ActivityLogData,
  SharedActivityCandidate,
} from "@/contexts/activities/types";
import { useActivities } from "@/contexts/activities/useActivities";
import { useGeolocation } from "@/hooks/useGeolocation";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useMetrics } from "@/contexts/metrics";
import { usePlans } from "@/contexts/plans";
import { createFileRoute } from "@tanstack/react-router";
import { differenceInHours } from "date-fns";
import type { Activity, ActivityEntry } from "@tsw/prisma";
import { Plus } from "lucide-react";
import { useCallback, useState } from "react";

export const Route = createFileRoute("/add")({
  component: LogPage,
});

function LogPage() {
  const {
    activities,
    activityEntries,
    isLoadingActivities,
    upsertActivityEntry,
    linkSharedActivity,
  } = useActivities();
  const { metrics } = useMetrics();
  const { plans } = usePlans();
  const { isUserPremium } = usePaidPlan();

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
  const [showDifficultyPopover, setShowDifficultyPopover] = useState(false);
  const [showMetricsPopover, setShowMetricsPopover] = useState(false);
  const [activityEditorOpen, setActivityEditorOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | undefined>(
    undefined
  );
  const [currentActivityLogData, setCurrentActivityLogData] =
    useState<ActivityLogData | null>(null);
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [sharedActivityCandidates, setSharedActivityCandidates] = useState<
    SharedActivityCandidate[]
  >([]);
  const [showSharedActivityPrompt, setShowSharedActivityPrompt] =
    useState(false);
  const geo = useGeolocation();

  const handleActivityLogSubmit = useCallback(
    async (data: ActivityLogData) => {
      if (!selectedActivity) return;

      let logData = data;
      try {
        const pos = await geo.getCurrentPosition();
        if (pos) {
          logData = {
            ...data,
            latitude: pos.latitude,
            longitude: pos.longitude,
          };
        }
      } catch {}

      setCurrentActivityLogData(logData);
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

  const continuePostLogFlow = (entryId: string) => {
    // Show difficulty popover only for paid coach automation and recent activity.
    const isWithin48Hours =
      currentActivityLogData &&
      differenceInHours(new Date(), currentActivityLogData.datetime) < 48;

    const isInActivePlan =
      plans?.some(
        (p) =>
          !p.deletedAt &&
          !p.archivedAt &&
          p.activities?.some((a) => a.id === selectedActivity?.id)
      ) ?? false;

    if (isUserPremium && isWithin48Hours && isInActivePlan) {
      setShowDifficultyPopover(true);
    } else {
      // Skip to metrics check if coach automation is not active or activity is older than 48h.
      handleDifficultyDone();
    }
  };

  const handleActivityLoggedAndPhotoSkippedOrDone = (
    entryId: string,
    candidates: SharedActivityCandidate[]
  ) => {
    setShowPhotoUploader(false);
    setCurrentEntryId(entryId);
    setSharedActivityCandidates(candidates);

    if (candidates.length > 0) {
      setShowSharedActivityPrompt(true);
      return;
    }

    continuePostLogFlow(entryId);
  };

  const handleSharedActivityPromptDone = () => {
    setShowSharedActivityPrompt(false);
    setSharedActivityCandidates([]);
    if (currentEntryId) {
      continuePostLogFlow(currentEntryId);
    }
  };

  const handleLinkSharedActivity = async (
    candidateActivityEntryIds: string[]
  ) => {
    if (!currentEntryId) return;
    for (const candidateActivityEntryId of candidateActivityEntryIds) {
      await linkSharedActivity({
        activityEntryId: currentEntryId,
        candidateActivityEntryId,
      });
    }
    handleSharedActivityPromptDone();
  };

  const handleDifficultySubmit = async (
    difficulty: DifficultyLevel,
    privateNotes?: string
  ) => {
    if (!currentEntryId) return;

    await upsertActivityEntry({
      entry: {
        id: currentEntryId,
        difficulty,
        ...(privateNotes !== undefined ? { privateNotes } : {}),
      } as Partial<ActivityEntry>,
      muteNotification: true,
    });
  };

  const handleDifficultyDone = () => {
    setShowDifficultyPopover(false);

    // Show metrics popover if user has metrics configured and activity was within the past 6 hours
    const isWithin6Hours =
      currentActivityLogData &&
      differenceInHours(new Date(), currentActivityLogData.datetime) < 6;

    if (metrics && metrics.length > 0 && isWithin6Hours) {
      setShowMetricsPopover(true);
    } else {
      // Clean up if not showing metrics
      setCurrentActivityLogData(null);
      setCurrentEntryId(null);
    }
  };

  const handleMetricsDone = () => {
    setShowMetricsPopover(false);
    setCurrentActivityLogData(null);
    setCurrentEntryId(null);
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
                withUserId: currentActivityLogData.withUserId,
                latitude: currentActivityLogData.latitude,
                longitude: currentActivityLogData.longitude,
              }}
              onClose={() => {
                setShowPhotoUploader(false);
              }}
              onSuccess={handleActivityLoggedAndPhotoSkippedOrDone}
            />
          )}
        </>
      )}

      <SharedActivityPrompt
        open={showSharedActivityPrompt}
        candidates={sharedActivityCandidates}
        onConfirm={handleLinkSharedActivity}
        onDismiss={handleSharedActivityPromptDone}
      />

      {/* Difficulty Popover - shown after activity is logged (within 48h) */}
      <DifficultyLogPopover
        open={showDifficultyPopover}
        onClose={handleDifficultyDone}
        onSubmit={async (difficulty, privateNotes) => {
          await handleDifficultySubmit(difficulty, privateNotes);
          handleDifficultyDone();
        }}
        activityTitle={selectedActivity?.title}
        activityEmoji={selectedActivity?.emoji}
      />

      {/* Metrics Popover - shown after difficulty (within 6h) */}
      <MetricsLogPopover
        open={showMetricsPopover}
        onClose={handleMetricsDone}
        title={`How are you feeling after ${selectedActivity?.title}?`}
        description="This helps us identify patterns and correlations between your activities and how you feel throughout the day."
        customIcon={<span className="text-6xl">{selectedActivity?.emoji}</span>}
        showActivityWarning={false}
      />
    </div>
  );
}

export default LogPage;
