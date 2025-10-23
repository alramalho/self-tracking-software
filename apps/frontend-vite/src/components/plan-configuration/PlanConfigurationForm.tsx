import { Button } from "@/components/ui/button";
import { useActivities } from "@/contexts/activities/useActivities";
import { type CompletePlan, usePlans } from "@/contexts/plans";
import { useCurrentUser } from "@/contexts/users";
import { usePlanGeneration } from "@/hooks/usePlanGeneration";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { type Activity, PlanOutlineType, Visibility } from "@tsw/prisma";
import { type PlanMilestone } from "@tsw/prisma/types";
import { ArrowRight, Lock, Loader2, MoveRight, Target } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import Divider from "../Divider";
import Step from "./Step";
import ActivitiesStep from "./steps/ActivitiesStep";
import CoachingStep from "./steps/CoachingStep";
import DurationStep from "./steps/DurationStep";
import EmojiStep from "./steps/EmojiStep";
import GoalStep from "./steps/GoalStep";
import MilestonesStep from "./steps/MilestonesStep";
import OutlineStep from "./steps/OutlineStep";
import VisibilityStep from "./steps/VisibilityStep";
import ConfirmDialogOrPopover from "../ConfirmDialogOrPopover";
import { useUpgrade } from "@/contexts/upgrade/useUpgrade";

interface PlanConfigurationFormProps {
  onSuccess?: () => void;
  onFailure?: (error: string) => void;
  onClose?: () => void;
  title: string;
  isEdit?: boolean;
  plan?: CompletePlan;
  scrollToMilestones?: boolean;
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void;
}

const PlanConfigurationForm: React.FC<PlanConfigurationFormProps> = ({
  plan,
  onSuccess,
  onClose,
  title,
  isEdit = false,
  scrollToMilestones = false,
  onUnsavedChangesChange,
}) => {
  const { currentUser } = useCurrentUser();
  const { activities } = useActivities();
  const { upsertPlan, isUpsertingPlan, plans } = usePlans();
  const { isUserPremium } = usePaidPlan();
  // Initialize state from plan if editing, otherwise use defaults
  const [isCoached, setIsCoached] = useState<boolean>(plan?.isCoached || false);
  const [description, setDescription] = useState<string | undefined>(
    plan?.notes || undefined
  );
  const [selectedEmoji, setSelectedEmoji] = useState<string | undefined>(
    plan?.emoji || undefined
  );
  const [currentFinishingDate, setCurrentFinishingDate] = useState(
    plan?.finishingDate
  );
  const [generatedSessions, setGeneratedSessions] = useState<
    {
      date: Date;
      activityId: string;
      descriptive_guide: string;
      quantity: number;
    }[]
  >();
  const [goal, setGoal] = useState<string | undefined>(plan?.goal || undefined);
  const [planNotes, setPlanNotes] = useState<string | undefined>(
    plan?.notes || undefined
  );
  const [milestones, setMilestones] = useState<PlanMilestone[]>(
    plan?.milestones || []
  );
  const [visibility, setVisibility] = useState<Visibility>(
    plan?.visibility || "PUBLIC"
  );
  const [outlineType, setOutlineType] = useState<PlanOutlineType>(
    plan?.outlineType || "SPECIFIC"
  );
  const [timesPerWeek, setTimesPerWeek] = useState<number | undefined>(
    plan?.timesPerWeek || undefined
  );
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedActivities, setSelectedActivities] = useState<Activity[]>(
    plan
      ? activities?.filter((a) =>
          plan.activities.map((ac: Activity) => ac.id).includes(a.id)
        ) || []
      : []
  );
  const [showCoachingConflict, setShowCoachingConflict] = useState(false);
  const { setShowUpgradePopover } = useUpgrade();
  const { generateSessions } = usePlanGeneration();

  // For free users, we skip the coaching step (show banner instead)
  // So we need to adjust step numbers accordingly
  const getActualStep = (displayStep: number) => {
    if (isUserPremium) return displayStep;
    // For free users, display steps are offset by -1 (no coaching step)
    return displayStep;
  };

  const canProgressToNextStep = useCallback(
    (step: number) => {
      // For premium users with coaching step
      if (isUserPremium) {
        switch (step) {
          case 1:
            return true; // Coaching choice is always valid
          case 2:
            return !!goal && goal.trim() !== "";
          case 3:
            return !!visibility;
          case 4:
            return true; // Finishing date is optional, always allow progression
          case 5:
            return !!selectedEmoji;
          case 6:
            return selectedActivities.length > 0;
          case 7:
            if (!outlineType) return false;
            if (outlineType === "SPECIFIC") return !!generatedSessions;
            if (outlineType === "TIMES_PER_WEEK")
              return timesPerWeek && timesPerWeek > 0;
            return false;
          default:
            return true;
        }
      } else {
        // For free users without coaching step (steps 1-7 instead of 1-8)
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
            if (outlineType === "TIMES_PER_WEEK")
              return timesPerWeek && timesPerWeek > 0;
            return false;
          default:
            return true;
        }
      }
    },
    [
      isUserPremium,
      goal,
      visibility,
      selectedEmoji,
      selectedActivities,
      outlineType,
      generatedSessions,
      timesPerWeek,
    ]
  );

  const handleStepChange = (direction: "next" | "back") => {
    const maxStep = isUserPremium ? 8 : 7;
    if (currentStep === maxStep) {
      return; // Already at last step
    }

    if (!canProgressToNextStep(currentStep)) {
      toast.error("Please complete the current step before proceeding");
      return;
    }

    setCurrentStep((prev) => {
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

      setGeneratedSessions(
        sessions.map((session) => ({
          ...session,
          date: new Date(session.date),
        }))
      );
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
      isCoached: isCoached,
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
    isCoached,
  ]);

  const hasMadeAnyChanges = useCallback(() => {
    if (!plan || !currentUser) return false;

    const planToBeSaved = createPlanToConfirm();
    const currentActivityIds = new Set(selectedActivities.map((a) => a.id));
    const originalActivityIds = new Set(
      plan.activities.map((a: Activity) => a.id)
    );

    return (
      planToBeSaved.goal !== plan.goal ||
      planToBeSaved.emoji !== plan.emoji ||
      planToBeSaved.finishingDate !== plan.finishingDate ||
      planToBeSaved.visibility !== plan.visibility ||
      planToBeSaved.outlineType !== plan.outlineType ||
      planToBeSaved.timesPerWeek !== plan.timesPerWeek ||
      planToBeSaved.isCoached !== plan.isCoached ||
      JSON.stringify(planToBeSaved.milestones) !==
        JSON.stringify(plan.milestones) ||
      JSON.stringify(planToBeSaved.sessions) !==
        JSON.stringify(plan.sessions) ||
      currentActivityIds.size !== originalActivityIds.size ||
      Array.from(currentActivityIds).some((id) => !originalActivityIds.has(id))
    );
  }, [createPlanToConfirm, plan, currentUser, selectedActivities]);

  const isPlanComplete = useCallback(() => {
    const hasRequiredFields =
      visibility &&
      goal &&
      goal.trim() !== "" &&
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
    const maxStep = isUserPremium ? 8 : 7;
    return currentStep === maxStep && isPlanComplete();
  }, [isEdit, hasMadeAnyChanges, isPlanComplete, currentStep, isUserPremium]);

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
        if ("activityId" in criterion && criterion.quantity <= 0) {
          toast.error(
            "All milestone criteria must have a quantity greater than 0"
          );
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

    // Check for coaching conflicts if isCoached is true
    if (isCoached) {
      const currentCoachedPlan = (plans as any[])?.find(
        (p: any) => p.isCoached && p.id !== plan?.id
      );

      if (currentCoachedPlan) {
        setShowCoachingConflict(true);
        return;
      }
    }

    const planToSave = createPlanToConfirm();
    upsertPlan({
      planId: plan?.id || "",
      updates: planToSave,
      muteNotifications: true,
    });
    toast.success(`${isEdit ? "Plan updated" : "Plan created"} successfully!`);
    onSuccess?.();
  };

  const handleCoachingConflictConfirm = async () => {
    const currentCoachedPlan = (plans as any[])?.find(
      (p: any) => p.isCoached && p.id !== plan?.id
    );

    // Uncoach the current coached plan
    if (currentCoachedPlan) {
      await upsertPlan({
        planId: currentCoachedPlan.id,
        updates: { isCoached: false },
        muteNotifications: true,
      });
    }

    // Save the new plan
    const planToSave = createPlanToConfirm();
    await upsertPlan({
      planId: plan?.id || "",
      updates: planToSave,
      muteNotifications: true,
    });

    toast.success(`${isEdit ? "Plan updated" : "Plan created"} successfully!`);
    setShowCoachingConflict(false);
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
    step8: useRef<HTMLDivElement>(null),
  };

  const scrollToStep = (stepNumber: number) => {
    stepRefs[
      `step${stepNumber}` as keyof typeof stepRefs
    ].current?.scrollIntoView({
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
      goal &&
      goal.trim() !== "" &&
      selectedEmoji &&
      selectedActivities.length > 0;

    if (!hasBasicInfo) return false;

    // Only allow generation for specific outline type
    if (!outlineType || outlineType === "TIMES_PER_WEEK") {
      return false;
    }

    return true;
  }, [visibility, goal, selectedEmoji, selectedActivities.length, outlineType]);

  useEffect(() => {
    if (scrollToMilestones && isEdit) {
      stepRefs.step8.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [scrollToMilestones, isEdit]);

  // Notify parent of unsaved changes
  useEffect(() => {
    if (isEdit && onUnsavedChangesChange) {
      onUnsavedChangesChange(hasMadeAnyChanges());
    }
  }, [
    isEdit,
    hasMadeAnyChanges,
    onUnsavedChangesChange,
    goal,
    selectedEmoji,
    currentFinishingDate,
    visibility,
    outlineType,
    timesPerWeek,
    isCoached,
    milestones,
    generatedSessions,
    selectedActivities,
  ]);

  return (
    <div
      data-testid="plan-configuration-form"
      className="space-y-6 max-w-3xl mx-auto"
    >
      <div className="space-y-6 relative">
        {/* Coaching Step or Upgrade Banner */}
        {isUserPremium ? (
          <Step
            stepNumber={1}
            isVisible={shouldShowStep(1)}
            ref={stepRefs.step1}
          >
            <CoachingStep
              number={1}
              isCoached={isCoached}
              setIsCoached={setIsCoached}
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
        ) : (
          <button className="w-full" onClick={() => setShowUpgradePopover(true)}>
            <div className="p-4 w-full text-left bg-card rounded-lg border-2 border-border opacity-60 cursor-pointer hover:opacity-75 transition-opacity">
              <div className="flex flex-row items-center gap-4 w-full">
                <Target className="w-7 h-7 text-muted-foreground self-start mt-2" />
                <div className="flex flex-col items-start gap-3">
                  <div className="flex-1">
                    <div className="font-medium text-muted-foreground">
                      Interested in personalized coaching?
                    </div>
                  </div>
                  <div className="flex flex-row items-center gap-2">
                    <span className="text-sm text-foreground">See plans</span>
                    <MoveRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </div>
          </button>
        )}

        <Step
          stepNumber={isUserPremium ? 2 : 1}
          isVisible={shouldShowStep(isUserPremium ? 2 : 1)}
          ref={isUserPremium ? stepRefs.step2 : stepRefs.step1}
        >
          <Divider />
          <GoalStep
            number={isUserPremium ? 2 : 1}
            goal={goal || ""}
            setGoal={setGoal}
            isEdit={isEdit}
          />
          {!isEdit && (
            <div className="flex justify-end mt-4">
              <Button
                onClick={() => handleStepChange("next")}
                disabled={!canProgressToNextStep(isUserPremium ? 2 : 1)}
              >
                Next
              </Button>
            </div>
          )}
        </Step>

        <Step
          stepNumber={isUserPremium ? 3 : 2}
          isVisible={shouldShowStep(isUserPremium ? 3 : 2)}
          ref={isUserPremium ? stepRefs.step3 : stepRefs.step2}
        >
          <Divider />
          <VisibilityStep
            number={isUserPremium ? 3 : 2}
            visibility={visibility}
            setVisibility={setVisibility}
          />
          {!isEdit && (
            <div className="flex justify-end mt-4">
              <Button
                onClick={() => handleStepChange("next")}
                disabled={!canProgressToNextStep(isUserPremium ? 3 : 2)}
              >
                Next
              </Button>
            </div>
          )}
        </Step>

        <Step
          stepNumber={isUserPremium ? 4 : 3}
          isVisible={shouldShowStep(isUserPremium ? 4 : 3)}
          ref={isUserPremium ? stepRefs.step4 : stepRefs.step3}
        >
          <Divider />
          <DurationStep
            number={isUserPremium ? 4 : 3}
            currentFinishingDate={currentFinishingDate || undefined}
            setCurrentFinishingDate={setCurrentFinishingDate}
          />
          {!isEdit && (
            <div className="flex justify-end mt-4">
              <Button
                onClick={() => handleStepChange("next")}
                disabled={!canProgressToNextStep(isUserPremium ? 4 : 3)}
              >
                Next
              </Button>
            </div>
          )}
        </Step>

        <Step
          stepNumber={isUserPremium ? 5 : 4}
          isVisible={shouldShowStep(isUserPremium ? 5 : 4)}
          ref={isUserPremium ? stepRefs.step5 : stepRefs.step4}
        >
          <Divider />
          <EmojiStep
            number={isUserPremium ? 5 : 4}
            selectedEmoji={selectedEmoji || ""}
            setSelectedEmoji={setSelectedEmoji}
          />
          {!isEdit && (
            <div className="flex justify-end mt-4">
              <Button
                onClick={() => handleStepChange("next")}
                disabled={!canProgressToNextStep(isUserPremium ? 5 : 4)}
              >
                Next
              </Button>
            </div>
          )}
        </Step>

        <Step
          stepNumber={isUserPremium ? 6 : 5}
          isVisible={shouldShowStep(isUserPremium ? 6 : 5)}
          ref={isUserPremium ? stepRefs.step6 : stepRefs.step5}
        >
          <Divider />
          <ActivitiesStep
            number={isUserPremium ? 6 : 5}
            onActivitiesChange={setSelectedActivities}
            initialActivities={selectedActivities}
          />
          {!isEdit && (
            <div className="flex justify-end mt-4">
              <Button
                onClick={() => handleStepChange("next")}
                disabled={!canProgressToNextStep(isUserPremium ? 6 : 5)}
              >
                Next
              </Button>
            </div>
          )}
        </Step>

        <Step
          stepNumber={isUserPremium ? 7 : 6}
          isVisible={shouldShowStep(isUserPremium ? 7 : 6)}
          ref={isUserPremium ? stepRefs.step7 : stepRefs.step6}
        >
          <Divider />
          <OutlineStep
            number={isUserPremium ? 7 : 6}
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
                disabled={!canProgressToNextStep(isUserPremium ? 7 : 6)}
              >
                Next
              </Button>
            </div>
          )}
        </Step>

        <Step
          stepNumber={isUserPremium ? 8 : 7}
          isVisible={shouldShowStep(isUserPremium ? 8 : 7)}
          ref={isUserPremium ? stepRefs.step8 : stepRefs.step7}
        >
          <Divider />
          <MilestonesStep
            number={isUserPremium ? 8 : 7}
            activities={selectedActivities}
            milestones={milestones}
            setMilestones={setMilestones}
          />
          {!isEdit && currentStep === (isUserPremium ? 8 : 7) && (
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

      <ConfirmDialogOrPopover
        isOpen={showCoachingConflict}
        onClose={() => setShowCoachingConflict(false)}
        onConfirm={handleCoachingConflictConfirm}
        title="Replace Coached Plan?"
        description="You already have another plan being coached. Enabling coaching for this plan will disable coaching on your current coached plan. Do you want to continue?"
        confirmText="Yes, Coach This Plan"
        cancelText="Cancel"
      />
    </div>
  );
};

export default PlanConfigurationForm;
