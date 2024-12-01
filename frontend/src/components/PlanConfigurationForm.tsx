import React, { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Activity,
  ApiPlan,
  GeneratedPlan,
  Plan,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import ActivitySelector from "./ActivitySelector";
import { Switch } from "./ui/switch";
import GeneratedPlanRenderer from "./GeneratedPlanRenderer";
import { usePlanGeneration } from "@/hooks/usePlanGeneration";
import toast from "react-hot-toast";
import { DatePicker } from "@/components/ui/date-picker";
import EmojiPicker from "emoji-picker-react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";

interface PlanConfigurationFormProps {
  onConfirm: (plan: GeneratedPlan) => Promise<void>;
  onClose?: () => void;
  title: string;
  isEdit?: boolean;
  plan?: ApiPlan;
}

interface CachedFormState {
  activities: Activity[];
  onlyTheseActivities: boolean;
  description: string;
  selectedEmoji: string;
  finishingDate?: string;
  goal: string;
  expiresAt: number;
}

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

const PlanConfigurationForm: React.FC<PlanConfigurationFormProps> = ({
  onConfirm,
  plan,
  onClose,
  title,
  isEdit = false,
}) => {
  const { useUserDataQuery } = useUserPlan();
  const userDataQuery = useUserDataQuery("me");
  const userData = userDataQuery.data;

  // Load initial state from localStorage or use defaults
  const loadInitialState = (): CachedFormState => {
    if (typeof window === "undefined") return getDefaultState();

    const cacheKey = isEdit
      ? `editPlanJourneyState_${plan?.id}`
      : "createPlanJourneyState";
    const saved = localStorage.getItem(cacheKey);

    if (saved) {
      const parsed = JSON.parse(saved);

      // Check if the saved state has expired (12 hours)
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        localStorage.removeItem(cacheKey);
        return getDefaultState();
      }

      return parsed;
    }
    return getDefaultState();
  };

  function getPlanActivities(plan: ApiPlan): Activity[] {
    const activityIds = new Set(
      plan.sessions.map((session) => session.activity_id)
    );
    return (
      userData?.activities?.filter((activity) =>
        activityIds.has(activity.id)
      ) || []
    );
  }
  const getDefaultState = (): CachedFormState => ({
    activities: plan ? getPlanActivities(plan) : [],
    onlyTheseActivities: true,
    description: "",
    selectedEmoji: plan?.emoji || "",
    finishingDate: plan?.finishing_date,
    goal: plan?.goal || "",
    expiresAt: Date.now() + 12 * 60 * 60 * 1000, // 12 hours from now
  });

  const initialState = loadInitialState();

  const [activities, setActivities] = useState<Activity[]>(
    initialState.activities
  );
  const [onlyTheseActivities, setOnlyTheseActivities] = useState(
    initialState.onlyTheseActivities
  );
  const [description, setDescription] = useState(initialState.description);
  const [selectedEmoji, setSelectedEmoji] = useState<string>(
    initialState.selectedEmoji
  );
  const [currentFinishingDate, setCurrentFinishingDate] = useState<
    string | undefined
  >(initialState.finishingDate || plan?.finishing_date);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(
    null
  );
  const { generatePlan } = usePlanGeneration();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [goal, setGoal] = useState(initialState.goal);

  // Split activities into existing and new
  const [existingActivities, setExistingActivities] = useState<Activity[]>(
    initialState.activities.filter((a) =>
      userData?.activities?.some((ua) => ua.id === a.id)
    )
  );
  const [newActivities, setNewActivities] = useState<Activity[]>(
    initialState.activities.filter(
      (a) => !userData?.activities?.some((ua) => ua.id === a.id)
    )
  );

  // Cache state changes - update to include both activity arrays
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stateToSave: CachedFormState = {
        activities: [...existingActivities, ...newActivities], // Combine for backwards compatibility
        onlyTheseActivities,
        description,
        selectedEmoji,
        finishingDate: currentFinishingDate,
        goal,
        expiresAt: Date.now() + 12 * 60 * 60 * 1000,
      };

      const cacheKey = isEdit
        ? `editPlanJourneyState_${plan?.id}`
        : "createPlanJourneyState";
      localStorage.setItem(cacheKey, JSON.stringify(stateToSave));
    }
  }, [
    existingActivities,
    newActivities,
    onlyTheseActivities,
    description,
    selectedEmoji,
    currentFinishingDate,
    goal,
    isEdit,
    plan?.id,
  ]);

  const handleGenerate = async () => {
    if (!goal || goal.trim() === "") {
      toast.error("Please enter a goal");
      return;
    }

    try {
      setIsGenerating(true);
      const plan = await generatePlan({
        goal,
        finishingDate: currentFinishingDate,
        activities: [...existingActivities, ...newActivities], // Combine both for generation
        onlyTheseActivities,
        description,
        isEdit,
      });
      setGeneratedPlan(plan);
    } catch (error) {
      console.error("Generation failed:", error);
      toast.error("Failed to generate plan");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirm = async () => {
    if (!generatedPlan) return;
    try {
      setIsGenerating(true);
      const enrichedPlan = {
        ...generatedPlan,
        emoji: selectedEmoji,
        finishing_date: currentFinishingDate,
      };
      await onConfirm(enrichedPlan);
      // Clear cache after successful confirmation
      const cacheKey = isEdit
        ? `editPlanJourneyState_${plan?.id}`
        : "createPlanJourneyState";
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.error("Confirmation failed:", error);
      toast.error("Failed to confirm plan");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div data-testid="plan-configuration-form" className="space-y-6" onClick={(e) => setShowEmojiPicker(false)}>
      {!generatedPlan ? (
        <>
          <div>
            <label className="text-lg font-medium mb-2 block" htmlFor="goal">
              What&apos;s your goal?
            </label>
            <Input
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="I want to gain the habit to go to the gym 3 times a week..."
              className="mb-4 text-[16px]"
            />
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2 block">
              Choose an emoji (Optional)
            </h3>
            {showEmojiPicker ? (
              <div
                className="absolute top-[30px] left-[15px] mt-2"
                style={{ zIndex: 1000 }}
                onClick={(e) => e.stopPropagation()}
              >
                <EmojiPicker
                  onEmojiClick={(data) => {
                    setSelectedEmoji(data.emoji);
                    setShowEmojiPicker(false);
                  }}
                />
              </div>
            ) : (
              <div
                id="emoji-picker-trigger"
                className="w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmojiPicker(true);
                }}
              >
                {
                  <span className="text-4xl">
                    {selectedEmoji || (
                      <Plus className="h-6 w-6 text-gray-400" />
                    )}
                  </span>
                }
              </div>
            )}
          </div>

          <div>
            <label
              className="text-sm font-medium mb-2 block"
              htmlFor="date-picker-trigger"
            >
              Set a finishing date
            </label>
            <DatePicker
              id="date-picker-trigger"
              selected={
                currentFinishingDate
                  ? new Date(currentFinishingDate)
                  : undefined
              }
              onSelect={(date: Date | undefined) =>
                setCurrentFinishingDate(date?.toISOString())
              }
              disablePastDates={true}
            />
          </div>

          <div className="space-y-8">
            {userData?.activities && userData.activities.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Your Existing Activities
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Select from activities you&apos;ve already created
                </p>
                <div data-testid="existing-activities" className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 mb-4">
                  {userData.activities
                    // Filter out activities that are in newActivities
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
                          setExistingActivities((prev) =>
                            prev.some((a) => a.id === activity.id)
                              ? prev.filter((a) => a.id !== activity.id)
                              : [...prev, activity]
                          );
                        }}
                      />
                    ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold mb-2">
                Create New Activities
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Add new activities for this plan
              </p>
              <ActivitySelector
                activities={newActivities}
                selectedActivity={undefined}
                onSelectActivity={(activity) => {
                  setNewActivities((prev) =>
                    prev.some((a) => a.id === activity.id)
                      ? prev.filter((a) => a.id !== activity.id)
                      : [...prev, activity]
                  );
                }}
                onSaveActivity={(activity) =>
                  setNewActivities((prev) => [...prev, activity])
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <Switch
              id="only-selected"
              checked={onlyTheseActivities}
              onCheckedChange={setOnlyTheseActivities}
            />
            <label htmlFor="only-selected" className="text-sm text-gray-500">
              Only use selected activities
            </label>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">
              Additional Customization
            </h3>
            <label htmlFor="customization">Additional Customization</label>
            <Textarea
              id="customization"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any specific requirements or preferences for your plan..."
              className="mb-4"
            />
          </div>

          <div className="flex gap-2">
            {onClose && (
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
            )}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : isEdit ? (
                "Generate Update"
              ) : (
                "Generate Plan"
              )}
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-6 mb-20">
          <h3 className="text-lg font-semibold">Preview Plan</h3>
          <GeneratedPlanRenderer title={title} plan={generatedPlan} />
          <Button
            variant="outline"
            onClick={() => setGeneratedPlan(null)}
            className=" w-full"
          >
            Back to Edit
          </Button>
          <div className="flex gap-2">
            <Button onClick={handleGenerate} className="flex-1">
              Regenerate
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isGenerating}
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEdit ? "Updating..." : "Creating..."}
                </>
              ) : isEdit ? (
                "Confirm Update"
              ) : (
                "Create Plan"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanConfigurationForm;
