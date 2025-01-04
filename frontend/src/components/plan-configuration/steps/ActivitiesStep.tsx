import React from "react";
import Number from "../Number";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import ActivitySelector from "@/components/ActivitySelector";
import { Activity } from "@/contexts/UserPlanContext";
import ActivityItem from "../ActivityItem";

interface ActivitiesStepProps {
  userData: {
    activities?: Activity[];
  } | null;
  existingActivities: Activity[];
  setExistingActivities: (activities: Activity[] | ((prev: Activity[]) => Activity[])) => void;
  newActivities: Activity[];
  setNewActivities: (activities: Activity[] | ((prev: Activity[]) => Activity[])) => void;
  description: string;
  setDescription: (description: string) => void;
}

const ActivitiesStep: React.FC<ActivitiesStepProps> = ({
  userData,
  existingActivities,
  setExistingActivities,
  newActivities,
  setNewActivities,
  description,
  setDescription,
}) => {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Number>4</Number>
          Your Existing Activities
        </h3>
        {userData?.activities && userData.activities.length > 0 && (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              Select from activities you&apos;ve already created
            </p>
            <div
              data-testid="existing-activities"
              className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 mb-4"
            >
              {userData.activities
                .filter(
                  (activity) =>
                    !newActivities.some((na) => na.id === activity.id)
                )
                .map((activity) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    isSelected={existingActivities.some(
                      (a) => a.id === activity.id
                    )}
                    onToggle={() => {
                      setExistingActivities((prev: Activity[]) =>
                        prev.some((a: Activity) => a.id === activity.id)
                          ? prev.filter((a: Activity) => a.id !== activity.id)
                          : [...prev, activity]
                      );
                    }}
                  />
                ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-lg font-semibold mb-2">Create New Activities</h3>
          <p className="text-sm text-gray-500 mb-4">
            Add new activities for this plan
          </p>
          <ActivitySelector
            activities={newActivities}
            selectedActivity={undefined}
            onSelectActivity={(activity: Activity) => {
              setNewActivities((prev: Activity[]) =>
                prev.some((a: Activity) => a.id === activity.id)
                  ? prev.filter((a: Activity) => a.id !== activity.id)
                  : [...prev, activity]
              );
            }}
            onSaveActivity={(activity: Activity) =>
              setNewActivities((prev: Activity[]) => [...prev, activity])
            }
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="customization-input"
          className="text-lg font-semibold mb-2 block"
        >
          Additional Customization
        </label>
        <Textarea
          id="customization-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add any specific requirements or preferences for your plan..."
          className="mb-4"
        />
      </div>
    </div>
  );
};

export default ActivitiesStep; 