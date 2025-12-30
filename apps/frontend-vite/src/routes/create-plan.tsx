import { ProgressBar } from "@/components/ProgressBar";
import { WizardContainer } from "@/components/plan-wizard/WizardContainer";
import BackgroundStepWizard from "@/components/plan-wizard/steps/BackgroundStepWizard";
import GoalStepWizard from "@/components/plan-wizard/steps/GoalStepWizard";
import EmojiStepWizard from "@/components/plan-wizard/steps/EmojiStepWizard";
import TimesPerWeekStepWizard from "@/components/plan-wizard/steps/TimesPerWeekStepWizard";
import CoachingStepWizard from "@/components/plan-wizard/steps/CoachingStepWizard";
import CoachSelectorStepWizard from "@/components/plan-wizard/steps/CoachSelectorStepWizard";
import VisibilityStepWizard from "@/components/plan-wizard/steps/VisibilityStepWizard";
import DurationStepWizard from "@/components/plan-wizard/steps/DurationStepWizard";
import ActivitiesStepWizard from "@/components/plan-wizard/steps/ActivitiesStepWizard";
import OutlineStepWizard from "@/components/plan-wizard/steps/OutlineStepWizard";
import MilestonesStepWizard from "@/components/plan-wizard/steps/MilestonesStepWizard";
import {
  PlanCreationProvider,
  usePlanCreation,
  type PlanCreationStep,
  type PlanCreationState,
} from "@/contexts/plan-creation";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, X } from "lucide-react";

export const Route = createFileRoute("/create-plan")({
  component: CreatePlanPage,
});

/**
 * Defines the plan creation step flow with dynamic navigation based on state.
 *
 * FLOW:
 * 1. goal - What you want to achieve (AI extracts goal + emoji)
 * 2. emoji - Visual representation (pre-filled from goal extraction)
 * 3. times-per-week - How often to work on this
 * 4. coaching - Coached (SPECIFIC) vs Self-Guided (TIMES_PER_WEEK)
 * 5. coach-selector - Choose AI or human coach (only if coached)
 * 6. visibility - Who can see the plan
 * 7. duration - Target finishing date (optional)
 * 8. activities - Select activities to track (with AI recommendations)
 * 9. outline - Generate SPECIFIC schedule (only if coached)
 * 10. milestones - Optional milestones
 * 11. background - Optional cover image, then CREATE
 */
const getPlanCreationSteps = (_state: PlanCreationState): PlanCreationStep[] => [
  {
    id: "goal",
    component: GoalStepWizard,
  },
  {
    id: "emoji",
    component: EmojiStepWizard,
  },
  {
    id: "times-per-week",
    component: TimesPerWeekStepWizard,
  },
  {
    id: "coaching",
    component: CoachingStepWizard,
    next: (state) => {
      if (state.isCoached) return "coach-selector";
      return "visibility";
    },
  },
  {
    id: "coach-selector",
    component: CoachSelectorStepWizard,
    next: "visibility",
    previous: "coaching",
  },
  {
    id: "visibility",
    component: VisibilityStepWizard,
    previous: (state) => {
      if (state.isCoached) return "coach-selector";
      return "coaching";
    },
  },
  {
    id: "duration",
    component: DurationStepWizard,
  },
  {
    id: "activities",
    component: ActivitiesStepWizard,
    next: (state) => {
      // Only go to outline step if coached (SPECIFIC plan)
      if (state.isCoached) return "outline";
      return "milestones";
    },
  },
  {
    id: "outline",
    component: OutlineStepWizard,
    previous: "activities",
  },
  {
    id: "milestones",
    component: MilestonesStepWizard,
    previous: (state) => {
      // Go back to outline if coached, otherwise activities
      if (state.isCoached) return "outline";
      return "activities";
    },
  },
  {
    id: "background",
    component: BackgroundStepWizard,
  },
];

const PlanCreationStepRenderer = () => {
  const { currentStepData, currentStep, totalSteps, prevStep, steps, isFirstStep, resetState } =
    usePlanCreation();
  const navigate = useNavigate();

  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);

  const handleClose = () => {
    resetState();
    navigate({ to: "/" });
  };

  const handleBack = () => {
    if (isFirstStep) {
      handleClose();
    } else {
      prevStep();
    }
  };

  return (
    <WizardContainer name={currentStepData?.id || "error"}>
      <ProgressBar
        current={currentStepIndex + 1}
        max={totalSteps}
        className="fixed top-0 left-0 rounded-none z-50"
      />
      <button
        onClick={handleBack}
        className="fixed m-0 top-8 left-2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer z-50"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={handleClose}
        className="fixed m-0 top-8 right-3 transform -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer z-50"
      >
        <X className="w-5 h-5" />
      </button>

      {!currentStepData ? (
        <div className="flex flex-col items-center justify-center h-full">
          <X size={48} className="text-red-500 mb-4" />
          <p className="text-muted-foreground">Error loading step</p>
        </div>
      ) : (
        <div className="pt-8">
          <currentStepData.component />
        </div>
      )}
    </WizardContainer>
  );
};

function CreatePlanPage() {
  const initialSteps = getPlanCreationSteps({
    currentStep: "goal",
    completedSteps: [],
    goal: null,
    emoji: null,
    backgroundImageUrl: null,
    backgroundImageFile: null,
    isCoached: false,
    selectedCoachId: null,
    selectedCoach: null,
    visibility: "PUBLIC",
    finishingDate: null,
    activities: [],
    outlineType: "TIMES_PER_WEEK", // Default to self-guided
    timesPerWeek: 3, // Default to 3 times per week
    generatedSessions: [],
    milestones: [],
    description: null,
    editingPlanId: null,
    editingSection: null,
    originalValues: null,
  });

  return (
    <PlanCreationProvider steps={initialSteps}>
      <PlanCreationStepRenderer />
    </PlanCreationProvider>
  );
}
