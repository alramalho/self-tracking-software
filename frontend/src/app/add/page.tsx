"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Activity } from "@prisma/client";
import { useUserPlan } from "@/contexts/UserGlobalContext";
import { Loader2, Plus } from "lucide-react";
import ActivityPhotoUploader from "@/components/ActivityPhotoUploader";
import { ActivityLoggerPopover } from "@/components/ActivityLoggerPopover";
import ActivityEditor from "@/components/ActivityEditor";
import {
  ActivityCard,
} from "@/components/ActivityCard";

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
  const activityEntries = userData?.activityEntries || [];
  
  // Sort activities by entry count
  const sortedActivities = [...activities].sort((a, b) => {
    const aEntryCount = activityEntries.filter(entry => entry.activityId === a.id).length;
    const bEntryCount = activityEntries.filter(entry => entry.activityId === b.id).length;
    return bEntryCount - aEntryCount; // Sort in descending order (most entries first)
  });
  
  const [selectedActivity, setSelectedActivity] = useState<
    Activity | undefined
  >();
  const [showPhotoUploader, setShowPhotoUploader] = useState(false);
  const [showActivityLogger, setShowActivityLogger] = useState(false);
  const [activityEditorOpen, setActivityEditorOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | undefined>(
    undefined
  );
  const [currentActivityLogData, setCurrentActivityLogData] = useState<ActivityLogData | null>(null);

  const handleActivityLogSubmit = useCallback((data: ActivityLogData) => {
    if (!selectedActivity) return;

    // This function now *only* sets state to show the ActivityPhotoUploader.
    // It does not make any API calls or queue any tasks directly.
    setCurrentActivityLogData(data);
    setShowActivityLogger(false); // Hide the logger popover
    setShowPhotoUploader(true);  // Show the photo uploader
  }, [selectedActivity]);

  const handleActivitySelected = (activity: Activity) => {
    setSelectedActivity(activity);
    setShowActivityLogger(true);
    // Reset these states in case a previous flow was interrupted
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
    setSelectedActivity(undefined);
    setCurrentActivityLogData(null);
    // Optionally refetch data if needed, though the components involved in API calls should handle their own refetches.
    // refetchUserData(); 
  };

  const metrics = metricsAndEntriesData?.metrics ?? [];

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
    <div className="container mx-auto px-4 py-8 mb-16 relative max-w-2xl ">
      <h1 className="text-2xl font-bold">Log Activity</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 my-6">
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
          className="flex flex-col items-left bg-gray-50 justify-center p-6 rounded-lg border-2 border-dashed border-gray-300 aspect-square hover:bg-gray-100"
        >
          <Plus className="h-8 w-8 text-gray-400 mb-2" />
          <span className="text-xl font-medium text-left text-gray-500">
            Add New
          </span>
        </button>
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
                // If closing without submitting, consider clearing selectedActivity if that's the desired UX
                // setSelectedActivity(undefined);
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
                date: currentActivityLogData.date, 
                quantity: currentActivityLogData.quantity,
              }}
              onClose={() => { 
                setShowPhotoUploader(false);
                // Optionally clear selectedActivity and currentActivityLogData if uploader is closed manually
                // setSelectedActivity(undefined);
                // setCurrentActivityLogData(null);
              }}
              onSuccess={handleActivityLoggedAndPhotoSkippedOrDone}
            />
          )}
        </>
      )}
    </div>
  );
};

export default LogPage;
