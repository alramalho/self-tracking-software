import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Activity,
  ApiPlan,
  GeneratedPlan,
  Plan,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import { usePlanGeneration } from "@/hooks/usePlanGeneration";
import toast from "react-hot-toast";
import Divider from "../Divider";
import Step from "./Step";
import {
  DurationStep,
  GoalStep,
  EmojiStep,
  ActivitiesStep,
  OutlineStep,
  PreviewStep,
} from "./steps";

interface PlanConfigurationFormProps {
  onConfirm: (plan: GeneratedPlan) => Promise<void>;
  onClose?: () => void;
  title: string;
  isEdit?: boolean;
  plan?: ApiPlan;
}

interface PlanDurationType {
  type: "custom" | "habit" | "lifestyle" | undefined;
  date?: string;
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
  const planData = userData?.plans?.find((p) => p.id === plan?.id);

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(
    null
  );
  const { generatePlan } = usePlanGeneration();
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

  const [outlineType, setOutlineType] = useState<Plan["outline_type"]>(
    initialState.outlineType
  );
  const [timesPerWeek, setTimesPerWeek] = useState<number>(
    initialState.timesPerWeek || 0
  );
  const [currentStep, setCurrentStep] = useState(1);

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

    setIsGenerating(true);
    await toast.promise(
      generatePlan({
        goal,
        finishingDate: currentFinishingDate?.split("T")[0], // remove time
        activities: [...existingActivities, ...newActivities], // Combine both for generation
        onlyTheseActivities,
        description,
        isEdit,
      }).then((plan) => {
        setGeneratedPlan(plan);
        setIsGenerating(false);
      }),
      {
        loading: "Generating your plan...",
        success: "Plan generated successfully",
        error: "Failed to generate plan",
      }
    );
  };

  const createPlanToConfirm = useCallback((): Partial<GeneratedPlan> => {
    const basePlan = {
      goal,
      emoji: selectedEmoji,
      finishing_date: currentFinishingDate,
      notes: planNotes,
      duration_type: planDuration.type,
      outline_type: outlineType,
      overview: "", // backwards compatibility
      intensity: "", // backwards compatibility
      activities: [...existingActivities, ...newActivities].map((activity) => ({
        id: activity.id,
        emoji: activity.emoji || "❓",
        title: activity.title,
        measure: activity.measure,
      })),
    };

    if (outlineType === "specific") {
      if (generatedPlan) {
        return {
          ...basePlan,
          ...generatedPlan,
        };
      }
      return basePlan;
    }

    // For times_per_week plans
    return {
      ...basePlan,
      times_per_week: timesPerWeek,
      sessions: [...existingActivities, ...newActivities].map((activity) => ({
        date: new Date(currentFinishingDate || new Date().toISOString()),
        descriptive_guide: "",
        quantity: 1,
        activity_id: activity.id,
        activity_name: activity.title,
        emoji: activity.emoji || "❓",
      })),
    };
  }, [
    goal,
    selectedEmoji,
    currentFinishingDate,
    planNotes,
    planDuration.type,
    outlineType,
    existingActivities,
    newActivities,
    timesPerWeek,
    generatedPlan,
  ]);

  const hasMadeAnyChanges = useCallback(() => {
    const planToBeSaved = createPlanToConfirm();

    if (!planData && !isEdit) return true; // New plan creation
    if (!planData) {
      return false;
    } // Edit mode but no plan data

    // Check basic plan properties
    if (planToBeSaved.goal !== planData.goal) return true;
    if (planToBeSaved.emoji !== planData.emoji) return true;
    if (planToBeSaved.finishing_date !== planData.finishing_date) return true;
    if (planToBeSaved.duration_type !== planData.duration_type) return true;
    if (planToBeSaved.outline_type !== planData.outline_type) return true;
    if (planToBeSaved.times_per_week !== planData.times_per_week) return true;

    // Check activities
    const currentActivityIds = new Set(
      planToBeSaved.activities?.map((a) => a.id) ?? []
    );
    const dbActivityIds = new Set(getPlanActivities(planData).map((a) => a.id));

    if (currentActivityIds.size !== dbActivityIds.size) return true;

    // Convert Set to Array for iteration
    return Array.from(currentActivityIds).some((id) => !dbActivityIds.has(id));
  }, [createPlanToConfirm, planData, isEdit, userData?.activities]);

  const canConfirmPlan = () => {
    if (outlineType === "specific" && !generatedPlan) {
      return false;
    } else {
      return hasMadeAnyChanges();
    }
  };
  const handleConfirm = async () => {
    try {
      setIsProcessing(true);

      const planToConfirm = createPlanToConfirm();

      // Clear cache after successful confirmation
      const cacheKey = isEdit
        ? `editPlanJourneyState_${plan?.id}`
        : "createPlanJourneyState";
      localStorage.removeItem(cacheKey);

      await onConfirm(planToConfirm as GeneratedPlan);
    } catch (error) {
      toast.error("Failed to confirm plan");
    } finally {
      setIsProcessing(false);
    }
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
    if (
      currentStep === 4 &&
      (existingActivities.length > 0 || newActivities.length > 0)
    ) {
      setCurrentStep(5);
      scrollToStep(5);
    }
    if (currentStep === 5 && outlineType == "specific") {
      setCurrentStep(6);
      scrollToStep(6);
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
      goal.trim() !== "" &&
      selectedEmoji &&
      (existingActivities.length > 0 || newActivities.length > 0) &&
      outlineType;

    if (!hasBasicInfo) return false;

    // Additional requirements based on outline type
    if (outlineType === "times_per_week") {
      return timesPerWeek > 0;
    }

    if (outlineType === "specific") {
      return !generatedPlan;
    }

    return false;
  };

  const shouldShowStep = (stepNumber: number) => {
    if (isEdit) return true;
    return stepNumber <= currentStep;
  };

  return (
    <div data-testid="plan-configuration-form" className="space-y-6">
      <div className="space-y-6 relative">
        <Step stepNumber={1} isVisible={shouldShowStep(1)} ref={stepRefs.step1}>
          <DurationStep
            planDuration={planDuration}
            currentFinishingDate={currentFinishingDate}
            setPlanDuration={setPlanDuration}
            setCurrentFinishingDate={setCurrentFinishingDate}
            setPlanNotes={setPlanNotes}
          />
        </Step>

        <Step stepNumber={2} isVisible={shouldShowStep(2)} ref={stepRefs.step2}>
          <Divider />
          <GoalStep
            goal={goal}
            setGoal={setGoal}
            goalConfirmed={goalConfirmed}
            setGoalConfirmed={setGoalConfirmed}
            isEdit={isEdit}
          />
        </Step>

        <Step stepNumber={3} isVisible={shouldShowStep(3)} ref={stepRefs.step3}>
          <Divider />
          <EmojiStep
            selectedEmoji={selectedEmoji}
            setSelectedEmoji={setSelectedEmoji}
          />
        </Step>

        <Step stepNumber={4} isVisible={shouldShowStep(4)} ref={stepRefs.step4}>
          <Divider />
          <ActivitiesStep
            userData={
              userData
                ? {
                    activities: userData.activities,
                  }
                : null
            }
            existingActivities={existingActivities}
            setExistingActivities={setExistingActivities}
            newActivities={newActivities}
            setNewActivities={setNewActivities}
            onlyTheseActivities={onlyTheseActivities}
            setOnlyTheseActivities={setOnlyTheseActivities}
            description={description}
            setDescription={setDescription}
          />
        </Step>

        <Step stepNumber={5} isVisible={shouldShowStep(5)} ref={stepRefs.step5}>
          <Divider />
          <OutlineStep
            outlineType={outlineType}
            setOutlineType={setOutlineType}
            timesPerWeek={timesPerWeek}
            setTimesPerWeek={setTimesPerWeek}
          />
        </Step>

        {outlineType === "specific" && generatedPlan && (
          <Step
            stepNumber={6}
            isVisible={shouldShowStep(6)}
            ref={stepRefs.step6}
            className="space-y-6"
          >
            <Divider />
            <PreviewStep
              title={title}
              generatedPlan={generatedPlan}
              onRegenerate={handleGenerate}
            />
          </Step>
        )}

        <div className="flex flex-col gap-2">
          {onClose && (
            <Button variant="outline" onClick={onClose}>
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
              ) : isEdit ? (
                "Confirm Update"
              ) : (
                "Create Plan"
              )}
            </Button>
          )}
          {canGeneratePlan() && (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-1 gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
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
