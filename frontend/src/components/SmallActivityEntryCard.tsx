import {
  format,
  isPast,
  isToday,
  parseISO,
  differenceInDays,
  isYesterday,
  isSameDay,
} from "date-fns";
import { Check } from "lucide-react";
import { ActivityEntry, Activity } from "@/contexts/UserPlanContext";
import { cn } from "@/lib/utils";

export interface Entry {
  date: Date;
  activityId: string;
  quantity: number;
  description?: string;
}

export const SmallActivityEntryCard = ({
  entry,
  activity,
  selected,
  onClick,
  completed,
  completedOn,
  className,
}: {
  entry: Entry;
  activity: Activity;
  selected?: boolean;
  onClick?: (sessionId: string) => void;
  completed?: boolean;
  completedOn?: Date;
  className?: string;
}) => {
  const dateInfoStr = (date: Date) => {
    const today = new Date();
    const diffInDays = Math.ceil(
      (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Tomorrow";
    return format(date, "EEEE");
  };

  const completedOnStr = (date: Date) => {
    if (isToday(date)) return "today";
    if (isYesterday(date)) return "yesterday";

    const daysDiff = differenceInDays(new Date(), date);
    if (daysDiff <= 7) {
      return format(date, "EEEE").toLowerCase();
    }
    return `${daysDiff} days ago`;
  };

  return (
    <>
      <div
        key={`${entry.date}-${entry.activityId}`}
        className={cn(
          `relative flex flex-col items-center justify-center rounded-lg bg-gray-100 p-2 transition-all duration-200 ${
            onClick ? "cursor-pointer bg-gray-100 hover:bg-opacity-80" : ""
          } ${selected ? "ring-2 ring-gray-300 ring-offset-2" : ""}`,
          className
        )}
        onClick={() => onClick?.(`${entry.date}-${entry.activityId}`)}
      >
        {completed && (
          <div className="absolute top-2 right-2">
            <Check className="h-5 w-5 text-green-500" />
          </div>
        )}
        {activity?.emoji && (
          <span className="text-2xl mb-2">{activity.emoji}</span>
        )}
        <span className="text-xs text-gray-500 mt-1 text-center">
          {dateInfoStr(entry.date)}
        </span>
        <span className="text-md font-medium text-center text-gray-800">
          {activity?.title || "Unknown Activity"}
        </span>
        <span className="text-xs text-gray-800 text-center mb-3">
          {entry.quantity} {activity?.measure}
        </span>
        {completedOn && !isSameDay(completedOn, entry.date) && (
          <span className="text-xs text-green-600 text-center">
            done {completedOnStr(completedOn)}
          </span>
        )}
      </div>

    </>
  );
};
