import { Button } from "@/components/ui/button";
import { useActivities } from "@/contexts/activities/useActivities";
import {
  type CompletePlan,
  usePlans
} from "@/contexts/plans";
import { useCurrentUser } from "@/contexts/users";
import { usePlanGeneration } from "@/hooks/usePlanGeneration";
import { type Activity, PlanOutlineType, Visibility } from "@tsw/prisma";
import { type PlanMilestone } from "@tsw/prisma/types";
import { Loader2 } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import Divider from "../Divider";
import Step from "./Step";
import ActivitiesStep from "./steps/ActivitiesStep";
import DurationStep from "./steps/DurationStep";
import EmojiStep from "./steps/EmojiStep";
import GoalStep from "./steps/GoalStep";
import MilestonesStep from "./steps/MilestonesStep";
import OutlineStep from "./steps/OutlineStep";
import VisibilityStep from "./steps/VisibilityStep";

interface PlanConfigurationFormProps {
  onSuccess?: () => void;
  onFailure?: (error: string) => void;
  onClose?: () => void;
  title: string;
  isEdit?: boolean;
  plan?: CompletePlan;
  scrollToMilestones?: boolean;
}

const PlanConfigurationForm: React.FC<PlanConfigurationFormProps> = ({
  plan,
  onSuccess,
  onClose,
  title,
  isEdit = false,
  scrollToMilestones = false,
}) => {
  const { currentUser } = useCurrentUser();
  const {activities} = useActivities();
  const { upsertPlan, isUpsertingPlan } = usePlans();
  // Initialize state from plan if editing, otherwise use defaults
  const [description, setDescription] = useState<string | undefined>(plan?.notes || undefined);
  const [selectedEmoji, setSelectedEmoji] = useState<string | undefined>(plan?.emoji || undefined);
  const [currentFinishingDate, setCurrentFinishingDate] = useState(plan?.finishingDate);
  const [generatedSessions, setGeneratedSessions] = useState<{date: Date, activityId: string, descriptive_guide: string, quantity: number}[]>();
  const [goal, setGoal] = useState<string | undefined>(plan?.goal || undefined);
  const [planNotes, setPlanNotes] = useState<string | undefined>(plan?.notes || undefined);
  const [milestones, setMilestones] = useState<PlanMilestone[]>(plan?.milestones || []);
  const [visibility, setVisibility] = useState<Visibility>((plan as any)?.visibility || "PUBLIC");
  const [outlineType, setOutlineType] = useState<PlanOutlineType>(plan?.outlineType || "SPECIFIC");
  const [timesPerWeek, setTimesPerWeek] = useState<number | undefined>(plan?.timesPerWeek || undefined);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedActivities, setSelectedActivities] = useState<Activity[]>(
    plan ? activities?.filter((a) => plan.activities.map((ac: Activity) => ac.id).includes(a.id)) || [] : []
  );

  const { generateSessions } = usePlanGeneration();

  const canProgressToNextStep = useCallback((step: number) => {
    switch (step) {
      case 1:
        return !!goal && goal.trim() !== "";
      case 2:
        return !!visibility;
      case 3:
        return true; // Finishing date is optional, always allow progression
      case 4:
        return !!selectedEmoji;
      case 5:
        return selectedActivities.length > 0;
      case 6:
        if (!outlineType) return false;
        if (outlineType === "SPECIFIC") return !!generatedSessions;
        if (outlineType === "TIMES_PER_WEEK") return timesPerWeek && timesPerWeek > 0;
        return false;
      default:
        return true;
    }
  }, [goal, visibility, selectedEmoji, selectedActivities, outlineType, generatedSessions, timesPerWeek]);

  const handleStepChange = (direction: "next" | "back") => {
    if (currentStep === 7) {
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
        finishingDate: currentFinishingDate || undefined,
        activities: selectedActivities,
        description,
        existingPlan: isEdit ? plan : undefined,
      });

      setGeneratedSessions(sessions.map(session => ({
        ...session,
        date: new Date(session.date),
      })));
    } catch (error) {
      toast.error("Failed to generate sessions");
    }
  };

  const createPlanToConfirm = useCallback(() => {
    const basePlan = {
      goal,
      emoji: selectedEmoji,
      finishingDate: currentFinishingDate || null,
      notes: planNotes,
      visibility: visibility,
      outlineType: outlineType,
      milestones: milestones,
      activities: selectedActivities,
      id: plan?.id || "",
      userId: plan?.userId || "",
      createdAt: plan?.createdAt || new Date(),
      sessions: [],
      timesPerWeek: timesPerWeek,
    };

    if (outlineType === "SPECIFIC") {
      return {
        ...basePlan,
        sessions: generatedSessions || [],
      };
    } else if (outlineType === "TIMES_PER_WEEK") {
      return {
        ...basePlan,
        timesPerWeek: timesPerWeek,
      };
    }
    return basePlan;
  }, [
    goal,
    selectedEmoji,
    currentFinishingDate,
    planNotes,
    visibility,
    outlineType,
    milestones,
    selectedActivities,
    plan?.id,
    plan?.userId,
    plan?.createdAt,
    generatedSessions,
    timesPerWeek,
  ]);

  const hasMadeAnyChanges = useCallback(() => {
    if (!plan || !currentUser) return false;

    const planToBeSaved = createPlanToConfirm();
    const currentActivityIds = new Set(selectedActivities.map((a) => a.id));
    const originalActivityIds = new Set(plan.activities.map((a: Activity) => a.id));

    return (
      planToBeSaved.goal !== plan.goal ||
      planToBeSaved.emoji !== plan.emoji ||
      planToBeSaved.finishingDate !== plan.finishingDate ||
      planToBeSaved.visibility !== (plan as any).visibility ||
      planToBeSaved.outlineType !== plan.outlineType ||
      planToBeSaved.timesPerWeek !== plan.timesPerWeek ||
      JSON.stringify(planToBeSaved.milestones) !== JSON.stringify(plan.milestones) ||
      JSON.stringify(planToBeSaved.sessions) !== JSON.stringify(plan.sessions) ||
      currentActivityIds.size !== originalActivityIds.size ||
      Array.from(currentActivityIds).some(id => !originalActivityIds.has(id))
    );
  }, [createPlanToConfirm, plan, currentUser, selectedActivities]);

  const isPlanComplete = useCallback(() => {
    const hasRequiredFields =
      visibility &&
      goal && goal.trim() !== "" &&
      selectedEmoji &&
      selectedActivities.length > 0 &&
      outlineType;

    if (!hasRequiredFields) return false;

    if (outlineType === "SPECIFIC" && !generatedSessions) return false;
    if (outlineType === "TIMES_PER_WEEK" && !timesPerWeek) return false;

    return true;
  }, [
    visibility,
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
    return currentStep === 7 && isPlanComplete();
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
      for (const criterion of milestone.criteria?.items || []) {
        if ('activityId' in criterion && criterion.quantity <= 0) {
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

    const planToSave = createPlanToConfirm();
    upsertPlan({ planId: plan?.id || "", updates: planToSave, muteNotifications: true });
    toast.success(`${isEdit ? "Plan updated" : "Plan created"} successfully!`);
    onSuccess?.();
  };

  const stepRefs = {
    step1: useRef<HTMLDivElement>(null),
    step2: useRef<HTMLDivElement>(null),
    step3: useRef<HTMLDivElement>(null),
    step4: useRef<HTMLDivElement>(null),
    step5: useRef<HTMLDivElement>(null),
    step6: useRef<HTMLDivElement>(null),
    step7: useRef<HTMLDivElement>(null),
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
      visibility &&
      goal && goal.trim() !== "" &&
      selectedEmoji &&
      selectedActivities.length > 0;

    if (!hasBasicInfo) return false;

    // Only allow generation for specific outline type
    if (!outlineType || outlineType === "TIMES_PER_WEEK") {
      return false;
    }

    return true;
  }, [
    visibility,
    goal,
    selectedEmoji,
    selectedActivities.length,
    outlineType,
  ]);

  useEffect(() => {
    if (scrollToMilestones && isEdit) {
      stepRefs.step7.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [scrollToMilestones, isEdit]);

  return (
    <div data-testid="plan-configuration-form" className="space-y-6 max-w-3xl mx-auto">
      <div className="space-y-6 relative">
        <Step stepNumber={1} isVisible={shouldShowStep(1)} ref={stepRefs.step1}>
          <GoalStep
            number={1}
            goal={goal || ""}
            setGoal={setGoal}
            isEdit={isEdit}
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
          <VisibilityStep
            number={2}
            visibility={visibility}
            setVisibility={setVisibility}
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
          <DurationStep
            number={3}
            currentFinishingDate={currentFinishingDate || undefined}
            setCurrentFinishingDate={setCurrentFinishingDate}
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
          <EmojiStep
            number={4}
            selectedEmoji={selectedEmoji || ""}
            setSelectedEmoji={setSelectedEmoji}
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
          <ActivitiesStep
            number={5}
            onActivitiesChange={setSelectedActivities}
            initialActivities={selectedActivities}
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
          <OutlineStep
            number={6}
            outlineType={outlineType}
            setOutlineType={setOutlineType}
            timesPerWeek={timesPerWeek || 0}
            setTimesPerWeek={setTimesPerWeek}
            title={title}
            generatedSessions={generatedSessions}
            canGenerate={canGeneratePlan}
            onGenerate={handleGenerate}
            activities={selectedActivities}
            finishingDate={currentFinishingDate || undefined}
            description={description || ""}
            setDescription={setDescription}
          />
          {!isEdit && (
            <div className="flex justify-end mt-4">
              <Button
                onClick={() => handleStepChange("next")}
                disabled={!canProgressToNextStep(6)}
              >
                Next
              </Button>
            </div>
          )}
        </Step>

        <Step stepNumber={7} isVisible={shouldShowStep(7)} ref={stepRefs.step7}>
          <Divider />
          <MilestonesStep
            number={7}
            activities={selectedActivities}
            milestones={milestones}
            setMilestones={setMilestones}
          />
          {!isEdit && currentStep === 7 && (
            <div className="flex justify-end mt-4">
              <Button
                onClick={handleConfirm}
                disabled={isUpsertingPlan || !isPlanComplete()}
                className="flex-1 gap-2"
              >
                {isUpsertingPlan ? (
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
              disabled={isUpsertingPlan}
              className="flex-1 gap-2"
            >
              {isUpsertingPlan ? (
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
