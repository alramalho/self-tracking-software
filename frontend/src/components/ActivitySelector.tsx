import { Activity } from "@/contexts/UserPlanContext";
import React, { useState } from "react";
import ActivityEditor from "./ActivityEditor";
import { Plus, Edit } from "lucide-react";
import { ActivityCard } from "./ActivityCard";

interface ActivitySelectorProps {
  activities: Activity[];
  selectedActivity: string;
  onSelectActivity: (activityId: string) => void;
}

const ActivitySelector: React.FC<ActivitySelectorProps> = ({
  activities,
  selectedActivity,
  onSelectActivity,
}) => {
  const [showEditor, setShowEditor] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  const handleAddActivity = () => {
    setEditingActivity(null);
    setShowEditor(true);
  };

  const handleEditActivity = (activity: Activity) => {
    setEditingActivity(activity);
    setShowEditor(true);
  };

  const handleSaveActivity = (savedActivity: Activity) => {
    setShowEditor(false);
    setEditingActivity(null);
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
        {activities.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            onClick={() => onSelectActivity(activity.id)}
            onEditClick={() => handleEditActivity(activity)}
            selected={selectedActivity === activity.id}
          />
        ))}
        <button
          onClick={handleAddActivity}
          className="flex flex-col items-left justify-center p-6 rounded-lg border-2 border-dashed border-gray-300 aspect-square hover:bg-gray-50"
        >
          <Plus className="h-8 w-8 text-gray-400 mb-2" />
          <span className="text-xl font-medium text-center text-gray-500">
            Add New
          </span>
        </button>
      </div>
      {showEditor && (
        <ActivityEditor
          onClose={() => {
            setShowEditor(false);
            setEditingActivity(null);
          }}
          onSave={handleSaveActivity}
          activity={editingActivity || undefined}
        />
      )}
    </>
  );
};

export default ActivitySelector;
