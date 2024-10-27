import { Activity } from "@/contexts/UserPlanContext";
import { Edit } from "lucide-react";

export const ActivityCard = ({
  activity,
  onClick,
  selected,
  onEditClick
}: {
  activity: Activity;
  onClick: () => void;
  selected: boolean;
  onEditClick?: () => void;
}) => {
  return (
    <div key={activity.id} className="relative">
      <button
        onClick={onClick}
        className={`flex flex-col items-left justify-center p-6 rounded-lg border-2 ${
          selected
            ? "border-blue-500 bg-blue-100"
            : "border-gray-300"
        } hover:bg-gray-50 aspect-square w-full`}
      >
        {activity.emoji && (
          <span className="text-4xl mb-2">{activity.emoji}</span>
        )}
        <span className="text-xl font-medium text-center">
          {activity.title}
        </span>
        <span className="text-sm text-gray-500 text-center">
          {activity.measure}
        </span>
      </button>
      {onEditClick && (
        <button
          onClick={onEditClick}
        className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
        >
          <Edit className="h-4 w-4 text-gray-500" />
        </button>
      )}
    </div>
  );
};
