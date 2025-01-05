import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Activity,
  ApiPlan,
  Plan,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import { usePlanGeneration } from "@/hooks/usePlanGeneration";
import toast from "react-hot-toast";
import Divider from "../Divider";
import Step from "./Step";
import MilestonesStep, { Milestone } from "./steps/MilestonesStep";
import OutlineStep from "./steps/OutlineStep";
import ActivitiesStep from "./steps/ActivitiesStep";
import EmojiStep from "./steps/EmojiStep";
import GoalStep from "./steps/GoalStep";
import DurationStep from "./steps/DurationStep";

interface PlanConfigurationFormProps {
  onConfirm: (plan: ApiPlan) => Promise<void>;
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
  description: string;
  selectedEmoji: string;
  planDurationType: PlanDurationType["type"];
  finishingDate?: string;
  outlineType: Plan["outline_type"];
  timesPerWeek: Plan["times_per_week"];
  goal: Plan["goal"];
  milestones: { date: Date; description: string }[];
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
      description: "",
      selectedEmoji: plan?.emoji || "",
      planDurationType: plan?.duration_type,
      finishingDate: plan?.finishing_date,
      outlineType: plan?.outline_type,
      timesPerWeek: plan?.times_per_week,
      goal: plan?.goal || "",
      milestones:
        plan?.milestones?.map((m) => ({
          date: new Date(m.date),
          description: m.description,
        })) || [],
      expiresAt: Date.now() + 12 * 60 * 60 * 1000, // 12 hours from now
    };
  };

  const initialState = loadInitialState();

  const [description, setDescription] = useState(initialState.description);
  const [selectedEmoji, setSelectedEmoji] = useState<string>(
    initialState.selectedEmoji
  );
  const [currentFinishingDate, setCurrentFinishingDate] = useState<
    string | undefined
  >(initialState.finishingDate || plan?.finishing_date);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSessions, setGeneratedSessions] = useState<ApiPlan['sessions'] | undefined>(undefined);
  const { generateSessions } = usePlanGeneration();
  const [goal, setGoal] = useState(initialState.goal);
  const [goalConfirmed, setGoalConfirmed] = useState(false);
  const [planNotes, setPlanNotes] = useState("");
  const [milestones, setMilestones] = useState<Milestone[]>(initialState.milestones || []);
  const [planDuration, setPlanDuration] = useState<PlanDurationType>({
    type: initialState.planDurationType
      ? initialState.planDurationType
      : initialState.finishingDate
      ? "custom"
      : undefined,
    date: initialState.finishingDate || currentFinishingDate,
  });

  useEffect(() => {
    console.log("milestones", milestones);
  }, [milestones]);

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
        description,
        selectedEmoji,
        planDurationType: plan?.duration_type ?? planDuration.type,
        finishingDate: currentFinishingDate,
        outlineType: outlineType,
        timesPerWeek: timesPerWeek,
        goal,
        milestones: milestones,
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
    description,
    selectedEmoji,
    currentFinishingDate,
    outlineType,
    timesPerWeek,
    goal,
    isEdit,
    plan?.id,
    planDuration.type,
    milestones,
  ]);

  const handleGenerate = async () => {
    if (!goal || goal.trim() === "") {
      toast.error("Please enter a goal");
      return;
    }

    setIsGenerating(true);
    await toast.promise(
      generateSessions({
        goal,
        finishingDate: currentFinishingDate?.split("T")[0], // remove time
        activities: [...existingActivities, ...newActivities], // Combine both for generation
        description,
        isEdit,
      }).then((sessions) => {
        setGeneratedSessions(sessions);
        setIsGenerating(false);
      }),
      {
        loading: "Generating your plan...",
        success: "Plan generated successfully",
        error: "Failed to generate plan",
      }
    );
  };

  const createPlanToConfirm = useCallback((): ApiPlan => {
    console.log("milestones", milestones);
    const basePlan: Omit<ApiPlan, 'id' | 'user_id' | 'created_at'> = {
      goal,
      emoji: selectedEmoji,
      finishing_date: currentFinishingDate,
      notes: planNotes,
      duration_type: planDuration.type,
      outline_type: outlineType,
      milestones: milestones,
      sessions: [],
    };

    if (outlineType === "specific") {
      if (generatedSessions) {
        return {
          ...basePlan,
          sessions: generatedSessions,
          id: plan?.id || '',
          user_id: plan?.user_id || '',
          created_at: plan?.created_at || new Date().toISOString(),
        };
      }
      return {
        ...basePlan,
        id: plan?.id || '',
        user_id: plan?.user_id || '',
        created_at: plan?.created_at || new Date().toISOString(),
      };
    }

    // For times_per_week plans
    return {
      ...basePlan,
      times_per_week: timesPerWeek,
      sessions: [...existingActivities, ...newActivities].map((activity) => ({
        date: currentFinishingDate || new Date().toISOString().split('T')[0],
        descriptive_guide: "",
        quantity: 1,
        activity_id: activity.id,
      })),
      id: plan?.id || '',
      user_id: plan?.user_id || '',
      created_at: plan?.created_at || new Date().toISOString(),
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
    generatedSessions,
    milestones,
    plan,
  ]);

  const hasMadeAnyChanges = useCallback(() => {
    const planToBeSaved = createPlanToConfirm();

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
    if (planToBeSaved.milestones !== planData.milestones) return true;
    if (planToBeSaved.sessions !== planData.sessions) return true;

    // Check activities
    const currentActivityIds = new Set(
      [...existingActivities, ...newActivities].map((a) => a.id)
    );
    const dbActivityIds = new Set(getPlanActivities(planData).map((a) => a.id));

    if (currentActivityIds.size !== dbActivityIds.size) return true;

    // Convert Set to Array for iteration
    return Array.from(currentActivityIds).some((id) => !dbActivityIds.has(id));
  }, [createPlanToConfirm, planData, isEdit, userData?.activities, milestones, existingActivities, newActivities]);

  const isPlanComplete = useCallback(() => {
    const planToBeSaved = createPlanToConfirm();

    if (!planToBeSaved.outline_type) return false;

    if (planToBeSaved.outline_type == "specific" && !generatedSessions)
      return false;

    if (
      planToBeSaved.outline_type == "times_per_week" &&
      !planToBeSaved.times_per_week
    )
      return false;

    return (
      planToBeSaved.duration_type &&
      planToBeSaved.finishing_date &&
      planToBeSaved.goal &&
      planToBeSaved.emoji &&
      [...existingActivities, ...newActivities].length > 0
    );
  }, [createPlanToConfirm, generatedSessions, planData, existingActivities, newActivities]);

  const canConfirmPlan = useCallback(() => {
    if (isEdit) {
      return hasMadeAnyChanges();
    } else {
      return isPlanComplete();
    }
  }, [outlineType, generatedSessions, isEdit, hasMadeAnyChanges, isPlanComplete]);
  
  const handleConfirm = async () => {
    try {
      setIsProcessing(true);

      const planToConfirm = createPlanToConfirm();

      // Clear cache after successful confirmation
      const cacheKey = isEdit
        ? `editPlanJourneyState_${plan?.id}`
        : "createPlanJourneyState";
      localStorage.removeItem(cacheKey);

      await onConfirm(planToConfirm as ApiPlan);
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
    if (currentStep === 5) {
      if (outlineType === "specific" && generatedSessions) {
        setCurrentStep(6);
        scrollToStep(6);
      }

      if (outlineType === "times_per_week" && timesPerWeek) {
        setCurrentStep(6);
        scrollToStep(6);
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
    generatedSessions,
  ]);

  const canGeneratePlan = useCallback(() => {
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
      return false;
    }

    if (outlineType === "specific") {
      return !generatedSessions;
    }

    return false;
  }, [
    planDuration.type,
    planDuration.date,
    goal,
    selectedEmoji,
    existingActivities.length,
    newActivities.length,
    outlineType,
    generatedSessions,
  ]);

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
            title={title}
            generatedSessions={generatedSessions}
            onRegenerate={handleGenerate}
            activities={[...existingActivities, ...newActivities]}
            finishingDate={currentFinishingDate}
          />
          {canGeneratePlan() && (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-1 gap-2 w-full mt-2"
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
        </Step>

        <Divider />

        <Step
          stepNumber={6}
          isVisible={shouldShowStep(6)}
          ref={stepRefs.step6}
          className="space-y-6"
        >
          <MilestonesStep
            milestones={milestones}
            setMilestones={setMilestones}
          />
        </Step>

        <Divider />

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
        </div>
      </div>
    </div>
  );
};

export default PlanConfigurationForm;
