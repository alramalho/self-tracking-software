import ActivityEditor from "@/components/ActivityEditor";
import { useActivities } from "@/contexts/activities/useActivities";
import { type Activity } from "@tsw/prisma";
import { Plus } from "lucide-react";
import React, { useEffect, useState } from "react";
import ActivityItem from "../ActivityItem";
import Number from "../Number";

interface ActivitiesStepProps {
  onActivitiesChange: (activities: Activity[]) => void;
  initialActivities?: Activity[];
  number: number;
}

const ActivitiesStep: React.FC<ActivitiesStepProps> = ({
  onActivitiesChange,
  initialActivities = [],
  number,
}) => {
  const {activities} = useActivities();
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
          <Number>{number}</Number>
          Your Activities
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select from activities you&apos;ve already created or add new ones
        </p>
        <div
          data-testid="existing-activities"
          className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4"
        >
          {activities?.map((activity) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              isSelected={selectedActivities.some((a) => a.id === activity.id)}
              onToggle={() => handleToggleActivity(activity)}
            />
          ))}
          <button
            onClick={() => setShowActivityEditor(true)}
            className="flex flex-col bg-input items-center justify-center p-4 rounded-lg border-2 border-dashed border-border aspect-square hover:bg-input/50"
          >
            <Plus className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm font-medium text-muted-foreground">Add New</span>
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