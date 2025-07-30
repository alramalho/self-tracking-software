import React, { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ApiPlan } from '@/contexts/UserPlanContext';

interface PlanTimesPerWeekUpdateBannerProps {
  timesPerWeek: number;
  old_timesPerWeek: number;
  plan?: ApiPlan;
  onAccept: () => Promise<void>;
  onReject: () => Promise<void>;
  disabled: boolean;
}

const PlanTimesPerWeekUpdateBanner: React.FC<PlanTimesPerWeekUpdateBannerProps> = ({
  timesPerWeek,
  old_timesPerWeek,
  plan,
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
    try {
      await onAccept();
    } catch (error) {
      toast.error('Failed to update plan frequency');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await onReject();
    } catch (error) {
      toast.error('Failed to reject plan frequency update');
    } finally {
      setIsRejecting(false);
    }
  };

  if (!plan) return null;

  return (
    <div className={`bg-white drop-shadow-md border border-gray-200 backdrop-blur-sm p-4 rounded-2xl flex items-center justify-between transition-shadow duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className="flex flex-row flex-nowrap w-full justify-start items-center gap-3">
        <span className="text-2xl">{plan.emoji || '📅'}</span>
        <p className="text-sm text-gray-700">
          Update &quot;{plan.goal}&quot; from {old_timesPerWeek} to {timesPerWeek} times per week?
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

export default PlanTimesPerWeekUpdateBanner; 