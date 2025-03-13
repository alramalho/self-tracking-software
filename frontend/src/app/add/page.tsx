"use client";

import React, { useState } from "react";
import { Activity, useUserPlan } from "@/contexts/UserPlanContext";
import { Loader2 } from "lucide-react";
import ActivitySelector from "@/components/ActivitySelector";
import ActivityPhotoUploader from "@/components/ActivityPhotoUploader";
import { ActivityLoggerPopover } from "@/components/ActivityLoggerPopover";
import { DailyCheckinCard } from "@/components/DailyCheckinCard";

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
  const [showActivityLogger, setShowActivityLogger] = useState(false);

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
