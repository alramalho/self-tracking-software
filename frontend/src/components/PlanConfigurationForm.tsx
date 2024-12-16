import React, { useState, useEffect, useRef } from "react";
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
import { Plus, Minus } from "lucide-react";
import { Check } from "lucide-react";
import Divider from "./Divider";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { addDays } from "date-fns";

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
  planDurationType: PlanDurationType["type"];
  finishingDate?: string;
  outlineType: Plan["outline_type"];
  timesPerWeek: Plan["times_per_week"];
  goal: Plan["goal"];
  expiresAt: number;
}

interface ActivityItemProps {
  activity: Activity;
  isSelected: boolean;
  onToggle: () => void;
}

interface PlanDurationType {
  type: "custom" | "habit" | "lifestyle" | undefined;
  date?: string;
}

interface DurationOptionProps {
  type: "habit" | "lifestyle" | "custom";
  title: string;
  description: string;
  emoji: string;
  isSelected: boolean;
  onSelect: () => void;
}

interface StepProps {
  stepNumber: number;
  isVisible: boolean;
  children: React.ReactNode;
  ref?: React.RefObject<HTMLDivElement>;
  className?: string;
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

const DurationOption: React.FC<DurationOptionProps> = ({
  type,
  title,
  description,
  emoji,
  isSelected,
  onSelect,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`relative flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 hover:bg-gray-50"
      }`}
    >
      {isSelected && (
        <Check className="absolute top-3 right-3 h-4 w-4 text-blue-500" />
      )}
      <span className="text-2xl mb-2">{emoji}</span>
      <h4 className="font-medium mb-1">{title}</h4>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
};

type OutlineType = {
  type: "specific" | "times_per_week";
  title: string;
  description: string;
  isSelected: boolean;
  onSelect: () => void;
};

const OutlineOption: React.FC<OutlineType> = ({
  type,
  title,
  description,
  isSelected,
  onSelect,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`relative flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 hover:bg-gray-50"
      }`}
    >
      {isSelected && (
        <Check className="absolute top-3 right-3 h-4 w-4 text-blue-500" />
      )}
      <h4 className="font-medium mb-1">{title}</h4>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
};

const Step = React.forwardRef<HTMLDivElement, StepProps>(
  ({ stepNumber, isVisible, children, className }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{
          opacity: isVisible ? 1 : 0,
          scale: isVisible ? 1 : 0.95,
          pointerEvents: isVisible ? "auto" : "none",
        }}
        transition={{ duration: 0.3 }}
        className={className}
      >
        {children}
      </motion.div>
    );
  }
);
Step.displayName = "Step";

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
      plan.sessions?.map((session) => session.activity_id) || []
    );
    return (
      userData?.activities?.filter((activity) =>
        activityIds.has(activity.id)
      ) || []
    );
  }
  const getDefaultState = (): CachedFormState => {
    return {
      activities: plan ? getPlanActivities(plan) : [],
      onlyTheseActivities: true,
      description: "",
      selectedEmoji: plan?.emoji || "",
      planDurationType: plan?.duration_type,
      finishingDate: plan?.finishing_date,
      outlineType: plan?.outline_type,
      timesPerWeek: plan?.times_per_week,
      goal: plan?.goal || "",
      expiresAt: Date.now() + 12 * 60 * 60 * 1000, // 12 hours from now
    };
  };

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(
    null
  );
  const { generatePlan } = usePlanGeneration();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [goal, setGoal] = useState(initialState.goal);
  const [goalConfirmed, setGoalConfirmed] = useState(false);
  const [planNotes, setPlanNotes] = useState("");
  const [planDuration, setPlanDuration] = useState<PlanDurationType>({
    type: initialState.planDurationType
      ? initialState.planDurationType
      : initialState.finishingDate
      ? "custom"
      : undefined,
    date: initialState.finishingDate || currentFinishingDate,
  });

  const [outlineType, setOutlineType] =
    useState<Plan["outline_type"]>(initialState.outlineType);
  const [timesPerWeek, setTimesPerWeek] = useState<number>(
    initialState.timesPerWeek || 0
  );
  const [currentStep, setCurrentStep] = useState(1);
  const [canConfirm, setCanConfirm] = useState(false);

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

  // Cache state changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stateToSave: CachedFormState = {
        activities: [...existingActivities, ...newActivities],
        onlyTheseActivities,
        description,
        selectedEmoji,
        planDurationType: plan?.duration_type ?? planDuration.type,
        finishingDate: currentFinishingDate,
        outlineType: outlineType,
        timesPerWeek: timesPerWeek,
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
    outlineType,
    timesPerWeek,
    goal,
    isEdit,
    plan?.id,
    planDuration.type,
  ]);

  const handleGenerate = async () => {
    if (!goal || goal.trim() === "") {
      toast.error("Please enter a goal");
      return;
    }

    await toast.promise(
      generatePlan({
        goal,
        finishingDate: currentFinishingDate?.split('T')[0], // remove time
        activities: [...existingActivities, ...newActivities], // Combine both for generation
        onlyTheseActivities,
        description,
        isEdit,
      }).then(plan => {
        setGeneratedPlan(plan);
      }),
      {
        loading: 'Generating your plan...',
        success: 'Plan generated successfully',
        error: 'Failed to generate plan'
      }
    );
  };


  const handleConfirm = async () => {
    try {
      setIsProcessing(true);
      
      let planToConfirm: GeneratedPlan;
      if (outlineType === "specific") {

        if (!generatedPlan) return;

        // For specific plans, use the generated plan
        planToConfirm = {
          ...generatedPlan,
          emoji: selectedEmoji,
          finishing_date: currentFinishingDate,
          notes: planNotes,
          duration_type: planDuration.type,
          outline_type: outlineType,
          sessions: generatedPlan.sessions,
        };
      } else {
        // For times_per_week plans, create plan without sessions
        planToConfirm = {
          goal,
          overview: "", // backwards compatibility
          intensity: "", // backwards compatibility
          emoji: selectedEmoji,
          finishing_date: currentFinishingDate,
          notes: planNotes,
          duration_type: planDuration.type,
          outline_type: outlineType,
          times_per_week: timesPerWeek,
          activities: [...existingActivities, ...newActivities].map(activity => ({
            id: activity.id,
            emoji: activity.emoji || "❓",
            title: activity.title,
            measure: activity.measure
          })),
          sessions: [...existingActivities, ...newActivities].map(activity => ({
            date: new Date(currentFinishingDate || new Date().toISOString()),
            descriptive_guide: "",
            quantity: 1,
            activity_id: activity.id,
            activity_name: activity.title,
            emoji: activity.emoji || "❓"
          }))
        };
      }

      // IMPORTANT MESSAGE: THIS IS HIGHLY DIRTY AND TBH BREAKING SOLID PRICINPLES. HERE WE'RE BOTH EDITING, CREATING A PLETHORA OF DIFFERENT PLAN TYPES, ANY FURTHER MODIFICATION NEEDS TO CLEAN THIS MESS. ENOUGH.

      // Clear cache after successful confirmation
      const cacheKey = isEdit
        ? `editPlanJourneyState_${plan?.id}`
        : "createPlanJourneyState";
      localStorage.removeItem(cacheKey);

      await onConfirm(planToConfirm);
    } catch (error) {
      console.error("Confirmation failed:", error);
      toast.error("Failed to confirm plan");
    } finally {
      setIsProcessing(false);
    }
  };

  const getDateFromDurationType = (type: "habit" | "lifestyle"): string => {
    const today = new Date();

    if (type === "habit") {
      return addDays(today, 21).toISOString(); // 21 days for habit
    } else {
      return addDays(today, 90).toISOString(); // 90 days for lifestyle
    }
  };

  const Number = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <span
      className={cn(
        "flex flex-shrink-0 items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium",
        className
      )}
    >
      {children}
    </span>
  );

  const shouldShowStep = (stepNumber: number) => {
    if (isEdit) return true;
    return stepNumber <= currentStep;
  };

  const stepRefs = {
    step1: useRef<HTMLDivElement>(null),
    step2: useRef<HTMLDivElement>(null),
    step3: useRef<HTMLDivElement>(null),
    step4: useRef<HTMLDivElement>(null),
    step5: useRef<HTMLDivElement>(null),
    step6: useRef<HTMLDivElement>(null),
  };

  const scrollToStep = (stepNumber: number) => {
    const ref = stepRefs[`step${stepNumber}` as keyof typeof stepRefs];
    if (ref.current) {
      ref.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  useEffect(() => {
    if (isEdit) return;

    if (currentStep === 1 && planDuration.date) {
      setCurrentStep(2);
      scrollToStep(2);
    }
    if (currentStep === 2 && goalConfirmed) {
      setCurrentStep(3);
      scrollToStep(3);
    }
    if (currentStep === 3 && selectedEmoji) {
      setCurrentStep(4);
      scrollToStep(4);
    }
    if (currentStep === 4 && 
      (existingActivities.length > 0 || newActivities.length > 0)) {
      setCurrentStep(5);
      scrollToStep(5);
    }
    if (currentStep === 5 && outlineType) {
      if (outlineType === "times_per_week") {
        if (timesPerWeek > 0) {
          setCanConfirm(true);
        }
      } else if (generatedPlan) {
        setCurrentStep(6);
        scrollToStep(6);
      } else {
        setCanConfirm(true);
      }
    }
  }, [
    planDuration.date,
    outlineType,
    timesPerWeek,
    goalConfirmed,
    selectedEmoji,
    existingActivities,
    newActivities,
    currentStep,
    isEdit,
    generatedPlan,
  ]);

  const canGeneratePlan = () => {
    // Basic requirements for all plan types
    const hasBasicInfo = 
      planDuration.type && 
      planDuration.date && 
      goal.trim() !== '' && 
      selectedEmoji && 
      (existingActivities.length > 0 || newActivities.length > 0) &&
      outlineType;

    if (!hasBasicInfo) return false;

    // Additional requirements based on outline type
    if (outlineType === 'times_per_week') {
      return timesPerWeek > 0;
    }

    return true;
  };

  const canConfirmPlan = () => {
    if (!canGeneratePlan()) return false;
    
    if (outlineType === "specific" && !isEdit) {
      return generatedPlan !== null;
    }

    return true;
  };

  return (
    <div
      data-testid="plan-configuration-form"
      className="space-y-6"
      onClick={(e) => setShowEmojiPicker(false)}
    >
      <div className="space-y-6 relative">
        <Step
          stepNumber={1}
          isVisible={shouldShowStep(1)}
          ref={stepRefs.step1}
        >
          <div className="space-y-4">
            <label className="text-lg font-medium block flex items-center gap-2">
              <Number className="w-6 h-6">1</Number>
              What are you trying to achieve?
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DurationOption
                type="habit"
                emoji="🌱"
                title="Habit Creation"
                description="This will set the finishing date to 21 days from now"
                isSelected={planDuration.type === "habit"}
                onSelect={() => {
                  const newDate = getDateFromDurationType("habit");
                  setPlanDuration({ type: "habit", date: newDate });
                  setCurrentFinishingDate(newDate);
                  setPlanNotes(
                    "This plan is an habit creation plan (21 days). In order to consider the habit created, all weeks must be completed."
                  );
                }}
              />

              <DurationOption
                type="lifestyle"
                emoji="🚀"
                title="Lifestyle Improvement"
                description="This will set the finishing date to 90 days from now"
                isSelected={planDuration.type === "lifestyle"}
                onSelect={() => {
                  const newDate = getDateFromDurationType("lifestyle");
                  setPlanDuration({ type: "lifestyle", date: newDate });
                  setCurrentFinishingDate(newDate);
                  setPlanNotes(
                    "This plan is an lifestyle improvement plan (90 days). In order to consider the lifestyle improved, at least 90% of the weeks must be completed."
                  );
                }}
              />

              <DurationOption
                type="custom"
                emoji="⚡️"
                title="Custom"
                description="Set your own timeline for achieving your goals"
                isSelected={planDuration.type === "custom"}
                onSelect={() => {
                  setPlanDuration({
                    type: "custom",
                    date: currentFinishingDate,
                  });
                  setPlanNotes("");
                }}
              />
            </div>

            {planDuration.type === "custom" && (
              <div className="mt-4">
                <label
                  className="text-sm font-medium mb-2 block"
                  htmlFor="date-picker-trigger"
                >
                  Set a custom finishing date
                </label>
                <DatePicker
                  id="date-picker-trigger"
                  selected={
                    currentFinishingDate
                      ? new Date(currentFinishingDate)
                      : undefined
                  }
                  onSelect={(date: Date | undefined) => {
                    const newDate = date?.toISOString();
                    setCurrentFinishingDate(newDate);
                    setPlanDuration({ type: "custom", date: newDate });
                  }}
                  disablePastDates={true}
                />
              </div>
            )}
          </div>
        </Step>

        <Step
          stepNumber={2}
          isVisible={shouldShowStep(2)}
          ref={stepRefs.step2}
        >
          <Divider />
          <div>
            <label
              className="text-lg font-medium mb-2 block flex items-center gap-2"
              htmlFor="goal"
            >
              <Number className="w-6 h-6">2</Number>
              Great, now what exactly do you want to do?
            </label>
            <div className="space-y-2">
              <Textarea
                id="goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="I want to gain the habit to go to the gym 3 times a week..."
                className="text-[16px]"
              />
              {!isEdit && (
                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      if (goal.trim().length === 0) {
                        toast.error("Please enter a goal first");
                        return;
                      }
                      setGoalConfirmed(true);
                    }}
                    disabled={goalConfirmed}
                    className="w-32"
                  >
                    {goalConfirmed ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      "Continue"
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Step>

        <Step
          stepNumber={3}
          isVisible={shouldShowStep(3)}
          ref={stepRefs.step3}
        >
          <Divider />
          <div>
            <h3 className="text-lg font-medium mb-2 block flex items-center gap-2">
              <Number className="w-6 h-6">3</Number>
              Choose a plan emoji
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
        </Step>

        <Step
          stepNumber={4}
          isVisible={shouldShowStep(4)}
          ref={stepRefs.step4}
        >
          <Divider />
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Number className="w-6 h-6">4</Number>
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
        </Step>

        <Step
          stepNumber={5}
          isVisible={shouldShowStep(5)}
          ref={stepRefs.step5}
        >
          <Divider />
          <div className="space-y-4">
            <label className="text-lg font-medium block flex items-center gap-2">
              <Number className="w-6 h-6">5</Number>
              How would you like to outline your plan?
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <OutlineOption
                type="specific"
                title="📆 Specific Schedule"
                description="An AI generated plan with a specific weekly schedule"
                isSelected={outlineType === "specific"}
                onSelect={() => setOutlineType("specific")}
              />

              <OutlineOption
                type="times_per_week"
                title="✅ Weekly Count Goal"
                description="A self-serve plan with just a number of sessions per week"
                isSelected={outlineType === "times_per_week"}
                onSelect={() => setOutlineType("times_per_week")}
              />
            </div>

            {outlineType === "times_per_week" && (
              <div className="mt-4">
                <label className="text-sm font-medium mb-2 block">
                  How many times per week?
                </label>
                <div className="flex items-center justify-center space-x-2 max-w-xs">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full bg-secondary text-primary-secondary"
                    onClick={() =>
                      setTimesPerWeek((prev) => Math.max(1, prev - 1))
                    }
                    disabled={timesPerWeek <= 1}
                  >
                    <Minus className="h-4 w-4" />
                    <span className="sr-only">Decrease</span>
                  </Button>
                  <div className="flex-1 text-center">
                    <div className="text-4xl font-bold tracking-tighter">
                      {timesPerWeek}
                    </div>
                    <div className="text-[0.70rem] uppercase text-muted-foreground">
                      Times per week
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full"
                    onClick={() =>
                      setTimesPerWeek((prev) => Math.min(7, prev + 1))
                    }
                    disabled={timesPerWeek >= 7}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="sr-only">Increase</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Step>

        {outlineType === "specific" && generatedPlan && (
          <Step
            stepNumber={6}
            isVisible={shouldShowStep(6)}
            ref={stepRefs.step6}
            className="space-y-6"
          >
            <Divider />
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Number className="w-6 h-6">6</Number>
                Preview & Accept Plan
              </h3>
              <GeneratedPlanRenderer title={title} plan={generatedPlan} />
              <Button variant="outline" className="w-full bg-gray-50" onClick={handleGenerate}>
                Regenerate
              </Button>
            </div>
          </Step>
        )}

        <div className="flex gap-2">
          {onClose && (
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          )}
          {canConfirmPlan() && (
            <Button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="flex-1 gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                isEdit ? "Confirm Update" : "Create Plan"
              )}
            </Button>
          )}
          {outlineType === "specific" && !generatedPlan && canGeneratePlan() && (
            <Button
              onClick={handleGenerate}
              disabled={isProcessing }
              className="flex-1 gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Generate Plan"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanConfigurationForm;
