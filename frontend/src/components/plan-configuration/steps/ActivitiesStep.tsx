import React, { useState, useEffect } from "react";
import Number from "../Number";
import { Activity, useUserPlan } from "@/contexts/UserPlanContext";
import ActivityItem  from "../ActivityItem";
import { Plus } from "lucide-react";
import ActivityEditor from "@/components/ActivityEditor";

interface ActivitiesStepProps {
  onActivitiesChange: (activities: Activity[]) => void;
  initialActivities?: Activity[];
}

const ActivitiesStep: React.FC<ActivitiesStepProps> = ({
  onActivitiesChange,
  initialActivities = [],
}) => {
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const [showActivityEditor, setShowActivityEditor] = useState(false);
  const [selectedActivities, setSelectedActivities] = useState<Activity[]>(initialActivities);

  // Update parent component when selected activities change
  useEffect(() => {
    onActivitiesChange(selectedActivities);
  }, [selectedActivities, onActivitiesChange]);

  const handleToggleActivity = (activity: Activity) => {
    setSelectedActivities((prev) =>
      prev.some((a) => a.id === activity.id)
        ? prev.filter((a) => a.id !== activity.id)
        : [...prev, activity]
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Number>4</Number>
          Your Activities
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Select from activities you&apos;ve already created or add new ones
        </p>
        <div
          data-testid="existing-activities"
          className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4"
        >
          {userData?.activities?.map((activity) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              isSelected={selectedActivities.some((a) => a.id === activity.id)}
              onToggle={() => handleToggleActivity(activity)}
            />
          ))}
          <button
            onClick={() => setShowActivityEditor(true)}
            className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed border-gray-300 aspect-square hover:bg-gray-50"
          >
            <Plus className="h-8 w-8 text-gray-400 mb-2" />
            <span className="text-sm font-medium text-gray-500">Add New</span>
          </button>
        </div>
      </div>

      <ActivityEditor
        open={showActivityEditor}
        onClose={() => setShowActivityEditor(false)}
      />
    </div>
  );
};

export default ActivitiesStep; 