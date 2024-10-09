import { Activity } from '@/contexts/UserPlanContext';
import React, { useState } from 'react';
import ActivityEditor from './ActivityEditor';
import { Plus, Edit } from 'lucide-react';

interface ActivitySelectorProps {
  activities: Activity[];
  selectedActivity: string;
  onSelectActivity: (activityId: string) => void;
  onActivityAdded: (activity: Activity) => void;
  onActivityUpdated: (activity: Activity) => void;
}

const ActivitySelector: React.FC<ActivitySelectorProps> = ({ 
  activities, 
  selectedActivity, 
  onSelectActivity,
  onActivityAdded,
  onActivityUpdated
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
    if (editingActivity) {
      onActivityUpdated(savedActivity);
    } else {
      onActivityAdded(savedActivity);
    }
    setShowEditor(false);
    setEditingActivity(null);
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
        {activities.map((activity) => (
          <div key={activity.id} className="relative">
            <button
              onClick={() => onSelectActivity(activity.id)}
              className={`flex flex-col items-left justify-center p-6 rounded-lg border-2 ${
                selectedActivity === activity.id ? 'border-blue-500 bg-blue-100' : 'border-gray-300'
              } hover:bg-gray-50 aspect-square w-full`}
            >
              {activity.emoji && <span className="text-4xl mb-2">{activity.emoji}</span>}
              <span className="text-xl font-medium text-center">{activity.title}</span>
            </button>
            <button
              onClick={() => handleEditActivity(activity)}
              className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
            >
              <Edit className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        ))}
        <button
          onClick={handleAddActivity}
          className="flex flex-col items-left justify-center p-6 rounded-lg border-2 border-dashed border-gray-300 aspect-square hover:bg-gray-50"
        >
          <Plus className="h-8 w-8 text-gray-400 mb-2" />
          <span className="text-xl font-medium text-center text-gray-500">Add New</span>
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