"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  useUserPlan,
  VisibilityType,
} from "@/contexts/UserPlanContext";
import { Loader2, Plus } from "lucide-react";
import ActivityPhotoUploader from "@/components/ActivityPhotoUploader";
import { ActivityLoggerPopover } from "@/components/ActivityLoggerPopover";
import ActivityEditor, {
  toReadablePrivacySetting,
} from "@/components/ActivityEditor";
import {
  ActivityCard,
  getActivityPrivacySettingIcon,
} from "@/components/ActivityCard";
import { useApiWithAuth } from "@/api";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import ActivityPrivacyDropdown from "@/components/ActivityPrivacyDropdown";

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
  const [editingActivity, setEditingActivity] = useState<Activity | undefined>(
    undefined
  );
  const api = useApiWithAuth();

  useEffect(() => {
    console.log({ editingActivity });
  }, [editingActivity]);

  const [activityLogData, setActivityLogData] =
    useState<ActivityLogData | null>(null);

  const handleActivitySelected = (activity: Activity) => {
    setSelectedActivity(activity);
    setShowActivityLogger(true);
  };

  const handleAddActivity = () => {
    setEditingActivity({
      id: "",
      title: "",
      measure: "",
      emoji: "",
      privacy_settings: "public",
    });
  };

  const handleEditActivity = (activity: Activity) => {
    setEditingActivity(activity);
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

  const updateActivityPrivacy = async (value: VisibilityType) => {
    await toast.promise(
      api.post("/update-user", {
        default_activity_visibility: value,
      }),
      {
        loading: "Updating privacy settings...",
        success: "Privacy settings updated",
        error: "Failed to update privacy settings",
      }
    );
    currentUserDataQuery.refetch();
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
      {userData?.user?.default_activity_visibility && (
        <div className="flex items-center justify-between mb-10">
          <div className="relative">
            <span className="text-sm text-gray-500 m-0">
              Your default activity visibility is: {" "}
            </span>
            <span className="text-[11px] text-gray-400 absolute top-full left-0">
              (Individual activities can be set to a different visibility)
            </span>
          </div>
          <ActivityPrivacyDropdown
            value={userData.user.default_activity_visibility}
            onChange={updateActivityPrivacy} // Read-only in this context
            className="text-sm text-gray-600"
          />
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        {activities.map((activity) => (
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
        open={!!editingActivity}
        onClose={() => {
          setEditingActivity(undefined);
        }}
        activity={editingActivity}
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
