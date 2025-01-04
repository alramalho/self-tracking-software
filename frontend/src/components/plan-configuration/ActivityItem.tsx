import { Check } from "lucide-react";
import { Activity } from "@/contexts/UserPlanContext";

interface ActivityItemProps {
  activity: Activity;
  isSelected: boolean;
  onToggle: () => void;
}

const ActivityItem: React.FC<ActivityItemProps> = ({
  activity,
  isSelected,
  onToggle,
}) => {
  return (
    <div
      onClick={onToggle}
      className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 aspect-square cursor-pointer transition-colors ${
        isSelected
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 hover:bg-gray-50"
      }`}
    >
      <div className="relative w-full h-full flex flex-col items-start justify-center">
        {isSelected && (
          <Check className="absolute top-0 right-0 h-4 w-4 text-blue-500" />
        )}
        <span className="text-xl">{activity.emoji}</span>
        <p className="text-sm font-medium text-left">{activity.title}</p>
        <p className="text-xs text-gray-500 text-left">{activity.measure}</p>
      </div>
    </div>
  );
};

export default ActivityItem; 