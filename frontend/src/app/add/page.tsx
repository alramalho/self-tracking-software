"use client";

import React, { useEffect, useState } from "react";
import { Activity, useUserPlan } from "@/contexts/UserPlanContext";
import { Loader2, Plus } from "lucide-react";
import { InsightsBanner } from "@/components/InsightsBanner";
import { Card } from "@/components/ui/card";
import ActivitySelector from "@/components/ActivitySelector";
import ActivityPhotoUploader from "@/components/ActivityPhotoUploader";
import { ActivityLoggerPopover } from "@/components/ActivityLoggerPopover";
import AINotification from "@/components/AINotification";
import { useApiWithAuth } from "@/api";
import { useRouter } from "next/navigation";
import { useAIMessageCache } from "@/hooks/useAIMessageCache";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";

interface ActivityLogData {
  date: Date;
  quantity: number;
}

const LogPage: React.FC = () => {
  const { useCurrentUserDataQuery, useMetricsAndEntriesQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const { data: metricsAndEntriesData } = useMetricsAndEntriesQuery();
  const activities = userData?.activities || [];
  const [selectedActivity, setSelectedActivity] = useState<
    Activity | undefined
  >();
  const [showPhotoUploader, setShowPhotoUploader] = useState(false);
  const [showInsightsBanner, setShowInsightsBanner] = useState(false);
  const [showActivityLogger, setShowActivityLogger] = useState(false);
  const [shouldShowNotification, setShouldShowNotification] = useState(false);
  const api = useApiWithAuth();
  const router = useRouter();

  const { isEnabled: isAIEnabled } = useFeatureFlag("ai-bot-access");
  const {
    message: aiMessage,
    messageId,
    isDismissed,
    dismiss,
    timestamp,
  } = useAIMessageCache("activity");

  useEffect(() => {
    if (aiMessage && !isDismissed && isAIEnabled) {
      setShouldShowNotification(true);
    }
  }, [aiMessage, isDismissed, isAIEnabled]);

  const [activityLogData, setActivityLogData] =
    useState<ActivityLogData | null>(null);

  const handleActivitySelected = (activity: Activity) => {
    setSelectedActivity(activity);
    setShowActivityLogger(true);
  };

  const handleActivityLogSubmit = (data: ActivityLogData) => {
    setActivityLogData(data);
    setShowActivityLogger(false);
    setShowPhotoUploader(true);
  };

  const handleActivityLogged = () => {
    setShowPhotoUploader(false);
    setSelectedActivity(undefined);
    setActivityLogData(null);
  };

  const metrics = metricsAndEntriesData?.metrics ?? [];
  const hasMetrics = metrics.length > 0;

  const metricEmojis = metrics
    .slice(0, 3)
    .map((m) => m.emoji)
    .filter(Boolean);
  const metricTitles = metrics.map((m) => m.title);
  const displayTitle =
    metricTitles.length > 1
      ? `${metricTitles[0]}${metricTitles.length > 1 ? "..." : ""}`
      : metricTitles[0] ?? "Rate your day";

  if (currentUserDataQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="mt-2">Loading Activities</p>
      </div>
    );
  }

  if (currentUserDataQuery.isError) {
    return <div>Error: {currentUserDataQuery.error.message}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 mb-16 relative">
      {/* {shouldShowNotification && isAIEnabled && (
        <AINotification
          message={aiMessage}
          createdAt={new Date(timestamp).toISOString()}
          onDismiss={() => {
            setShouldShowNotification(false);
            dismiss();
          }}
          onClick={() => {
            setShouldShowNotification(false);
            router.push(
              `/ai?assistantType=activity-extraction&messageId=${messageId}&messageText=${aiMessage}`
            );
          }}
        />
      )} */}

      {hasMetrics && (
        <>
          <h1 className="text-2xl font-bold mb-6">Log Metrics</h1>
          <Card
            className="mb-8 p-4 cursor-pointer border-2 border-gray-300 transition-colors"
            onClick={() => setShowInsightsBanner(true)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex">
                  {metricEmojis.map((emoji, index) => (
                    <span
                      key={index}
                      className="text-2xl relative -ml-2 first:ml-0"
                      style={{ zIndex: metricEmojis.length - index }}
                    >
                      {emoji}
                    </span>
                  ))}
                </div>
                <span className="text-lg ml-2 font-medium">{displayTitle}</span>
              </div>
              <Plus className="w-5 h-5 text-gray-500" />
            </div>
          </Card>

          <InsightsBanner
            open={showInsightsBanner}
            onClose={() => setShowInsightsBanner(false)}
          />
        </>
      )}

      <h1 className="text-2xl font-bold mb-6">Log Activity</h1>
      <ActivitySelector
        activities={activities}
        selectedActivity={selectedActivity}
        onSelectActivity={handleActivitySelected}
      />

      {selectedActivity && (
        <>
          <ActivityLoggerPopover
            open={showActivityLogger}
            onClose={() => setShowActivityLogger(false)}
            selectedActivity={selectedActivity}
            onSubmit={handleActivityLogSubmit}
          />

          <ActivityPhotoUploader
            open={showPhotoUploader}
            activityData={{
              activityId: selectedActivity.id,
              date: activityLogData?.date ?? new Date(),
              quantity: activityLogData?.quantity ?? 0,
            }}
            onClose={() => setShowPhotoUploader(false)}
            onSuccess={handleActivityLogged}
          />
        </>
      )}
    </div>
  );
};

export default LogPage;
