"use client";

import { Check } from "lucide-react";
import * as React from "react";
import { Button } from "./ui/button";
import AppleLikePopover from "./AppleLikePopover";
import FeedbackForm from "./FeedbackForm";
import { User, useUserPlan } from "@/contexts/UserPlanContext";
import toast from "react-hot-toast";
import { useApiWithAuth } from "@/api";
import Link from "next/link";
import { getThemeVariants } from "@/utils/theme";
import { useThemeColors } from "@/hooks/useThemeColors";

interface RecurrentCheckinPopoverProps {
  open: boolean;
  onClose: () => void;
}

const RecurrentCheckinPopover: React.FC<RecurrentCheckinPopoverProps> = ({
  open,
  onClose,
}) => {
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const email = userData?.user?.email || "";
  const api = useApiWithAuth();
  const [isFeedbackOpen, setIsFeedbackOpen] = React.useState(false);
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const [isSaving, setIsSaving] = React.useState(false);

  type DayType = NonNullable<User['dailyCheckinSettings']>['days'][number];
  type TimeType = NonNullable<User['dailyCheckinSettings']>['time'];
  
  const [selectedDays, setSelectedDays] = React.useState<DayType[]>(
    userData?.user?.dailyCheckinSettings?.days || []
  );
  const [selectedTimes, setSelectedTimes] = React.useState<TimeType | null>(
    userData?.user?.dailyCheckinSettings?.time || null
  );

  const days = {
    MON: "Monday",
    TUE: "Tuesday", 
    WED: "Wednesday",
    THU: "Thursday",
    FRI: "Friday",
    SAT: "Saturday",
    SUN: "Sunday"
  } as const;
  const timeOfDay = {
    MORNING: "Morning",
    AFTERNOON: "Afternoon",
    EVENING: "Evening"
  } as const;
  const descriptionOfTimeOfDay = ["7-10am", "12-3pm", "6-9pm"];

  const toggleDay = (day: string) => {
    const dayKey = Object.entries(days).find(([_, value]) => value === day)?.[0] as DayType;
    if (dayKey) {
      setSelectedDays((prev) =>
        prev.includes(dayKey) ? prev.filter((d) => d !== dayKey) : [...prev, dayKey]
      );
    }
  };

  const toggleTime = (time: string) => {
    const timeKey = Object.entries(timeOfDay).find(([_, value]) => value === time)?.[0] as TimeType;
    if (timeKey) {
      setSelectedTimes((prev) => (prev === timeKey ? null : timeKey));
    }
  };

  const submitFeedback = async (text: string, email: string) => {
    await toast.promise(
      api.post("/report-feedback", {
        email,
        text,
        type: "feature_request",
      }),
      {
        loading: "Sending feedback...",
        success: "Feedback sent successfully! We'll get back to you soon.",
        error: "Failed to send feedback",
      }
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await toast.promise(
        api.post("/user/daily-checkin-settings", {
          days: selectedDays,
          time: selectedTimes,
        }),
        {
          loading: "Saving settings...",
          success: "Settings saved successfully!",
          error: "Failed to save settings",
        }
      );
    } catch (error) {
      setIsSaving(false);
      return;
    } finally {
      setIsSaving(false);
      currentUserDataQuery.refetch();
      onClose();
    }
  };

  return (
    <AppleLikePopover open={open} onClose={onClose}>
      <div className="p-4">
        <h3 className="text-lg font-semibold">☀️ Customize Recurrent Checkin</h3>
        <p className="text-gray-400 text-sm mt-2">
          This check-in is a simple question sent to you to encite reflection on
          the day past, paired up with{" "}
          <Link href="/insights/dashboard" className="underline">
            metrics
          </Link>{" "}
          logging.
        </p>

        <p
          className="text-gray-400 leading-relaxed underline text-sm cursor-pointer"
          onClick={() => setIsFeedbackOpen(true)}
        >
          Would you like to customize this?
        </p>

        <div className="space-y-2 mt-8">
          <p className="text-md text-gray-600 font-medium">
            Select check-in days:
          </p>
          <div className="space-y-2">
            {Object.entries(days).map(([key, day]) => (
              <div
                key={key}
                className="flex justify-between items-center space-x-3"
              >
                <div
                  className="relative w-5 h-5 flex items-center justify-center cursor-pointer"
                  onClick={() => toggleDay(day)}
                >
                  {selectedDays.includes(key as DayType) && (
                    <Check className={`h-5 w-5 ${variants.text}`} />
                  )}
                </div>
                <label
                  onClick={() => toggleDay(day)}
                  className="text-sm text-gray-600 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                >
                  Every {day}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2 mt-8">
          <p className="text-md text-gray-600 font-medium">
            Select time of day:
          </p>
          <div className="flex flex-row gap-3">
            {Object.entries(timeOfDay).map(([key, time], index) => (
              <div
                key={key}
                className={`relative flex-1 p-4 rounded-md border cursor-pointer transition-all ${
                  selectedTimes === key as TimeType
                    ? `${variants.card.selected.border} ${variants.card.selected.bg}`
                    : "border-gray-300"
                }`}
                onClick={() => toggleTime(time)}
              >
                <div className="absolute top-1 right-1">
                  {selectedTimes === key as TimeType && (
                    <Check className={`h-4 w-4 ${variants.text}`} />
                  )}
                </div>
                <div className="flex flex-col items-center justify-center">
                  <span className="text-sm font-medium">{time}</span>
                  <span className="text-xs text-gray-500">
                    {descriptionOfTimeOfDay[index]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button loading={isSaving} onClick={handleSave} className="w-full my-8">Save</Button>
      </div>
      <AppleLikePopover
        open={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      >
        <FeedbackForm
          title="📩 Customize Recurrent Check-in Feedback"
          email={email}
          onSubmit={submitFeedback}
          onClose={() => setIsFeedbackOpen(false)}
          className="contents"
          defaultValue="I would like the recurrent checkin to..."
        />
      </AppleLikePopover>
    </AppleLikePopover>
  );
};

export default RecurrentCheckinPopover; 