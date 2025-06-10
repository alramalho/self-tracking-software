import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Activity,
  ApiPlan,
  Plan,
  PlanMilestone,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import { usePlanGeneration } from "@/hooks/usePlanGeneration";
import toast from "react-hot-toast";
import Divider from "../Divider";
import Step from "./Step";
import MilestonesStep from "./steps/MilestonesStep";
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
  scrollToMilestones?: boolean;
}

interface PlanDurationType {
  type: "custom" | "habit" | "lifestyle" | undefined;
  date?: string;
}

const PlanConfigurationForm: React.FC<PlanConfigurationFormProps> = ({
  onConfirm,
  plan,
  onClose,
  title,
  isEdit = false,
  scrollToMilestones = false,
}) => {
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;

  // Initialize state from plan if editing, otherwise use defaults
  const [description, setDescription] = useState(plan?.notes || "");
  const [selectedEmoji, setSelectedEmoji] = useState(plan?.emoji || "");
  const [currentFinishingDate, setCurrentFinishingDate] = useState(plan?.finishing_date);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedSessions, setGeneratedSessions] = useState<ApiPlan["sessions"]>();
  const [goal, setGoal] = useState(plan?.goal || "");
  const [planNotes, setPlanNotes] = useState("");
  const [milestones, setMilestones] = useState<PlanMilestone[]>(plan?.milestones || []);
  const [planDuration, setPlanDuration] = useState<PlanDurationType>({
    type: plan?.duration_type,
    date: plan?.finishing_date,
  });
  const [outlineType, setOutlineType] = useState<Plan["outline_type"]>(plan?.outline_type);
  const [timesPerWeek, setTimesPerWeek] = useState(plan?.times_per_week || 0);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedActivities, setSelectedActivities] = useState<Activity[]>(
    plan ? userData?.activities?.filter(a => plan.activity_ids?.includes(a.id)) || [] : []
  );

  const { generateSessions } = usePlanGeneration();

  const canProgressToNextStep = useCallback((step: number) => {
    switch (step) {
      case 1:
        return !!planDuration.type;
      case 2:
        return !!goal.trim();
      case 3:
        return !!selectedEmoji;
      case 4:
        return selectedActivities.length > 0;
      case 5:
        if (!outlineType) return false;
        if (outlineType === "specific") return !!generatedSessions;
        if (outlineType === "times_per_week") return timesPerWeek > 0;
        return false;
      default:
        return true;
    }
  }, [planDuration, goal, selectedEmoji, selectedActivities, outlineType, generatedSessions, timesPerWeek]);

  const handleStepChange = (direction: "next" | "back") => {
    if (currentStep === 6) {
      return; // Already at last step
    }
    
    if (!canProgressToNextStep(currentStep)) {
      toast.error("Please complete the current step before proceeding");
      return;
    }
    
    setCurrentStep(prev => {
      const nextStep = prev + 1;
      scrollToStep(nextStep);
      return nextStep;
    });
  };

  const handleGenerate = async () => {
    if (!goal || goal.trim() === "") {
      toast.error("Please enter a goal");
      return;
    }

    try {
      const sessions = await generateSessions({
        goal,
        finishingDate: currentFinishingDate?.split("T")[0],
        activities: selectedActivities,
        description,
        existingPlan: isEdit ? plan : undefined,
      });

      setGeneratedSessions(sessions);
    } catch (error) {
      toast.error("Failed to generate sessions");
    }
  };

  const createPlanToConfirm = useCallback((): ApiPlan => {
    const basePlan: ApiPlan = {
      goal,
      emoji: selectedEmoji,
      finishing_date: currentFinishingDate,
      notes: planNotes,
      duration_type: planDuration.type,
      outline_type: outlineType,
      milestones: milestones,
      activity_ids: selectedActivities.map((a) => a.id),
      id: plan?.id || "",
      user_id: plan?.user_id || "",
      created_at: plan?.created_at || new Date().toISOString(),
      coach_suggested_sessions: [],
      sessions: [],
    };

    if (outlineType === "specific") {
      return {
        ...basePlan,
        sessions: generatedSessions || [],
      };
    } else if (outlineType === "times_per_week") {
      return {
        ...basePlan,
        times_per_week: timesPerWeek,
      };
    }
    return basePlan;
  }, [
    goal,
    selectedEmoji,
    currentFinishingDate,
    planNotes,
    planDuration.type,
    outlineType,
    milestones,
    selectedActivities,
    plan?.id,
    plan?.user_id,
    plan?.created_at,
    generatedSessions,
    timesPerWeek,
  ]);

  const hasMadeAnyChanges = useCallback(() => {
    if (!plan || !userData) return false;

    const planToBeSaved = createPlanToConfirm();
    const currentActivityIds = new Set(selectedActivities.map(a => a.id));
    const originalActivityIds = new Set(plan.activity_ids);

    return (
      planToBeSaved.goal !== plan.goal ||
      planToBeSaved.emoji !== plan.emoji ||
      planToBeSaved.finishing_date !== plan.finishing_date ||
      planToBeSaved.duration_type !== plan.duration_type ||
      planToBeSaved.outline_type !== plan.outline_type ||
      planToBeSaved.times_per_week !== plan.times_per_week ||
      JSON.stringify(planToBeSaved.milestones) !== JSON.stringify(plan.milestones) ||
      JSON.stringify(planToBeSaved.sessions) !== JSON.stringify(plan.sessions) ||
      currentActivityIds.size !== originalActivityIds.size ||
      Array.from(currentActivityIds).some(id => !originalActivityIds.has(id))
    );
  }, [createPlanToConfirm, plan, userData, selectedActivities]);

  const isPlanComplete = useCallback(() => {
    const hasRequiredFields = 
      planDuration.type &&
      goal.trim() !== "" &&
      selectedEmoji &&
      selectedActivities.length > 0 &&
      outlineType;

    if (!hasRequiredFields) return false;

    if (outlineType === "specific" && !generatedSessions) return false;
    if (outlineType === "times_per_week" && !timesPerWeek) return false;

    return true;
  }, [
    planDuration,
    goal,
    selectedEmoji,
    selectedActivities,
    outlineType,
    generatedSessions,
    timesPerWeek,
  ]);

  const canConfirmPlan = useCallback(() => {
    if (isEdit) {
      return hasMadeAnyChanges();
    }
    return currentStep === 6 && isPlanComplete();
  }, [isEdit, hasMadeAnyChanges, isPlanComplete, currentStep]);

  const validateMilestones = useCallback(() => {
    if (!milestones.length) return true; // Milestones are optional

    for (const milestone of milestones) {
      // Check title
      if (!milestone.description?.trim()) {
        toast.error("All milestones must have a title");
        return false;
      }

      // Check criteria
      for (const criterion of milestone.criteria || []) {
        if ('activity_id' in criterion && criterion.quantity <= 0) {
          toast.error("All milestone criteria must have a quantity greater than 0");
          return false;
        }
      }
    }

    return true;
  }, [milestones]);

  const handleConfirm = async () => {
    if (!validateMilestones()) {
      return;
    }

    try {
      setIsProcessing(true);
      await onConfirm(createPlanToConfirm());
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
    stepRefs[`step${stepNumber}` as keyof typeof stepRefs].current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const shouldShowStep = (stepNumber: number) => {
    if (isEdit) return true;
    return stepNumber <= currentStep;
  };

  const canGeneratePlan = useCallback(() => {
    // Basic requirements for all plan types
    const hasBasicInfo =
      planDuration.type &&
      goal.trim() !== "" &&
      selectedEmoji &&
      selectedActivities.length > 0;

    if (!hasBasicInfo) return false;

    // Only allow generation for specific outline type
    if (!outlineType || outlineType === "times_per_week") {
      return false;
    }

    return true;
  }, [
    planDuration.type,
    goal,
    selectedEmoji,
    selectedActivities.length,
    outlineType,
  ]);

  useEffect(() => {
    if (scrollToMilestones && isEdit) {
      stepRefs.step6.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [scrollToMilestones, isEdit]);

  return (
    <div data-testid="plan-configuration-form" className="space-y-6 max-w-3xl mx-auto">
      <div className="space-y-6 relative">
        <Step stepNumber={1} isVisible={shouldShowStep(1)} ref={stepRefs.step1}>
          <DurationStep
            planDuration={planDuration}
            currentFinishingDate={currentFinishingDate}
            setPlanDuration={setPlanDuration}
            setCurrentFinishingDate={setCurrentFinishingDate}
            setPlanNotes={setPlanNotes}
          />
          {!isEdit && (
            <div className="flex justify-end mt-4">
              <Button
                onClick={() => handleStepChange("next")}
                disabled={!canProgressToNextStep(1)}
              >
                Next
              </Button>
            </div>
          )}
        </Step>

        <Step stepNumber={2} isVisible={shouldShowStep(2)} ref={stepRefs.step2}>
          <Divider />
          <GoalStep
            goal={goal}
            setGoal={setGoal}
            isEdit={isEdit}
          />
          {!isEdit && (
            <div className="flex justify-end mt-4">
              <Button
                onClick={() => handleStepChange("next")}
                disabled={!canProgressToNextStep(2)}
              >
                Next
              </Button>
            </div>
          )}
        </Step>

        <Step stepNumber={3} isVisible={shouldShowStep(3)} ref={stepRefs.step3}>
          <Divider />
          <EmojiStep
            selectedEmoji={selectedEmoji}
            setSelectedEmoji={setSelectedEmoji}
          />
          {!isEdit && (
            <div className="flex justify-end mt-4">
              <Button
                onClick={() => handleStepChange("next")}
                disabled={!canProgressToNextStep(3)}
              >
                Next
              </Button>
            </div>
          )}
        </Step>

        <Step stepNumber={4} isVisible={shouldShowStep(4)} ref={stepRefs.step4}>
          <Divider />
          <ActivitiesStep
            onActivitiesChange={setSelectedActivities}
            initialActivities={selectedActivities}
          />
          {!isEdit && (
            <div className="flex justify-end mt-4">
              <Button
                onClick={() => handleStepChange("next")}
                disabled={!canProgressToNextStep(4)}
              >
                Next
              </Button>
            </div>
          )}
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
            canGenerate={canGeneratePlan}
            onGenerate={handleGenerate}
            activities={selectedActivities}
            finishingDate={currentFinishingDate}
            description={description}
            setDescription={setDescription}
          />
          {!isEdit && (
            <div className="flex justify-end mt-4">
              <Button
                onClick={() => handleStepChange("next")}
                disabled={!canProgressToNextStep(5)}
              >
                Next
              </Button>
            </div>
          )}
        </Step>

        <Step stepNumber={6} isVisible={shouldShowStep(6)} ref={stepRefs.step6}>
          <Divider />
          <MilestonesStep
            activities={selectedActivities}
            milestones={milestones}
            setMilestones={setMilestones}
          />
          {!isEdit && currentStep === 6 && (
            <div className="flex justify-end mt-4">
              <Button
                onClick={handleConfirm}
                disabled={isProcessing || !isPlanComplete()}
                className="flex-1 gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Create Plan"
                )}
              </Button>
            </div>
          )}
        </Step>

        <Divider />

        <div className="flex flex-col gap-2">
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
          {isEdit && canConfirmPlan() && (
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
                "Confirm Update"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanConfigurationForm;
