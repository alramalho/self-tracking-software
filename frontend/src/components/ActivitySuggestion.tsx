import React from 'react';
import { Check, X } from 'lucide-react';
import { useApiWithAuth } from '@/api';
import toast from 'react-hot-toast';
import { Activity, ActivityEntry } from '@/contexts/UserPlanContext';

interface ActivitySuggestionProps {
  activity: Activity;
  activityEntry: ActivityEntry;
  onAccept: (activityEntry: ActivityEntry, activity: Activity) => void;
  onReject: (activityEntry: ActivityEntry, activity: Activity) => void;
}

const ActivitySuggestion: React.FC<ActivitySuggestionProps> = ({
  activity,
  activityEntry,
  onAccept,
  onReject,
}) => {
  const api = useApiWithAuth();
  const buttonClasses = "p-2 rounded-full transition-colors duration-200 flex items-center justify-center";
  const iconSize = 20;

  const handleAccept = async () => {
    try {
      await api.post('/log-activity', {
        activity_id: activity.id,
        iso_date_string: activityEntry.date,
        quantity: activityEntry.quantity,
        has_photo: false,
      });
      toast.success('Activity logged successfully!');
      onAccept(activityEntry, activity);
    } catch (error) {
      toast.error('Failed to log activity');
    }
  };

  return (
    <div className="mb-4 bg-white drop-shadow-md border border-gray-200 backdrop-blur-sm p-4 rounded-2xl flex items-center justify-between transition-shadow duration-200 ">
      <div className="flex flex-row flex-nowrap w-full justify-start items-center gap-3">
        <span className="text-2xl">{activity.emoji}</span>
        <p className="text-sm text-gray-700">
          Log {activityEntry.quantity} {activity.measure} of {activity.title} on {new Date(activityEntry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}?
        </p>
      </div>
      <div className="flex ml-4">
        <button
          onClick={handleAccept}
          className={`${buttonClasses} bg-green-100 text-green-600 hover:bg-green-200`}
          aria-label="Accept"
        >
          <Check size={iconSize} />
        </button>
        <button
          onClick={() => onReject(activityEntry, activity)}
          className={`${buttonClasses} bg-red-100 text-red-600 hover:bg-red-200 ml-2`}
          aria-label="Reject"
        >
          <X size={iconSize} />
        </button>
      </div>
    </div>
  );
};

export default ActivitySuggestion; 