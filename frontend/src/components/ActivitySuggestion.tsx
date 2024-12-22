import React, { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { useApiWithAuth } from '@/api';
import toast from 'react-hot-toast';
import { Activity, ActivityEntry } from '@/contexts/UserPlanContext';

interface ActivitySuggestionProps {
  activity: Activity;
  activityEntry: ActivityEntry;
  onAccept: (activityEntry: ActivityEntry, activity: Activity) => void;
  onReject: (activityEntry: ActivityEntry, activity: Activity) => void;
  disabled: boolean;
}

const ActivitySuggestion: React.FC<ActivitySuggestionProps> = ({
  activity,
  activityEntry,
  onAccept,
  onReject,
  disabled,
}) => {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const buttonClasses = "p-2 rounded-full transition-colors duration-200 flex items-center justify-center";
  const iconSize = 20;

  const handleAccept = async () => {
    setIsAccepting(true);
    await onAccept(activityEntry, activity);
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await onReject(activityEntry, activity);
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div onClick={() => {
      if (disabled) {
        toast.error('You must be connected to the AI to talk to it.');
        return;
      };
    }} className={`${disabled ? 'opacity-50' : ''} bg-white drop-shadow-md border border-gray-200 backdrop-blur-sm p-4 rounded-2xl flex items-center justify-between transition-shadow duration-200 `}>
      <div className="flex flex-row flex-nowrap w-full justify-start items-center gap-3">
        <span className="text-2xl">{activity.emoji}</span>
        <p className="text-sm text-gray-700">
          Log {activityEntry.quantity} {activity.measure} of {activity.title} on {new Date(activityEntry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}?
        </p>
      </div>
      <div className="flex ml-4">
        <button
          onClick={handleAccept}
          disabled={isAccepting || isRejecting || disabled}
          className={`${buttonClasses} ${
            isAccepting ? 'bg-green-50' : 'bg-green-100 hover:bg-green-200'
          } text-green-600`}
          aria-label="Accept"
        >
          {isAccepting ? (
            <Loader2 size={iconSize} className="animate-spin" />
          ) : (
            <Check size={iconSize} />
          )}
        </button>
        <button
          onClick={handleReject}
          disabled={isAccepting || isRejecting || disabled}
          className={`${buttonClasses} ${
            isRejecting ? 'bg-red-50' : 'bg-red-100 hover:bg-red-200'
          } text-red-600 ml-2`}
          aria-label="Reject"
        >
          {isRejecting ? (
            <Loader2 size={iconSize} className="animate-spin" />
          ) : (
            <X size={iconSize} />
          )}
        </button>
      </div>
    </div>
  );
};

export default ActivitySuggestion; 