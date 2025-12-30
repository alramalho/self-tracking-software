import { ProgressBar } from "@/components/ProgressBar";
import { WizardContainer } from "@/components/plan-wizard/WizardContainer";
import OverviewStepWizard from "@/components/plan-wizard/steps/OverviewStepWizard";
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
import BackgroundStepWizard from "@/components/plan-wizard/steps/BackgroundStepWizard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PlanCreationProvider,
  usePlanCreation,
  type PlanCreationStep,
  type PlanCreationState,
} from "@/contexts/plan-creation";
import { usePlans } from "@/contexts/plans";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, X } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/edit-plan/$planId")({
  component: EditPlanPage,
});

/**
 * Edit mode step flow - starts with overview, can jump to any step
 */
const getEditPlanSteps = (_state: PlanCreationState): PlanCreationStep[] => [
  {
    id: "overview",
    component: OverviewStepWizard,
  },
  {
    id: "goal",
    component: GoalStepWizard,
    next: "overview",
    previous: "overview",
  },
  {
    id: "emoji",
    component: EmojiStepWizard,
    next: "overview",
    previous: "overview",
  },
  {
    id: "times-per-week",
    component: TimesPerWeekStepWizard,
    next: "overview",
    previous: "overview",
  },
  {
    id: "coaching",
    component: CoachingStepWizard,
    next: (state) => {
      if (state.isCoached) return "coach-selector";
      return "overview";
    },
    previous: "overview",
  },
  {
    id: "coach-selector",
    component: CoachSelectorStepWizard,
    next: "overview",
    previous: "coaching",
  },
  {
    id: "visibility",
    component: VisibilityStepWizard,
    next: "overview",
    previous: "overview",
  },
  {
    id: "duration",
    component: DurationStepWizard,
    next: "overview",
    previous: "overview",
  },
  {
    id: "activities",
    component: ActivitiesStepWizard,
    next: (state) => {
      if (state.isCoached) return "outline";
      return "overview";
    },
    previous: "overview",
  },
  {
    id: "outline",
    component: OutlineStepWizard,
    next: "overview",
    previous: "activities",
  },
  {
    id: "milestones",
    component: MilestonesStepWizard,
    next: "overview",
    previous: "overview",
  },
  {
    id: "background",
    component: BackgroundStepWizard,
    next: "overview",
    previous: "overview",
  },
];

const EditPlanStepRenderer = () => {
  const { currentStepData, currentStep, prevStep, resetState } = usePlanCreation();
  const navigate = useNavigate();

  const handleClose = () => {
    resetState();
    navigate({ to: "/" });
  };

  const handleBack = () => {
    if (currentStep === "overview") {
      handleClose();
    } else {
      prevStep();
    }
  };

  return (
    <WizardContainer name={currentStepData?.id || "error"}>
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

const EditPlanLoader = ({ planId }: { planId: string }) => {
  const { plans, isLoadingPlans } = usePlans();
  const { initializeForEdit } = usePlanCreation();
  const navigate = useNavigate();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (isLoadingPlans || initialized) return;

    const plan = plans?.find((p) => p.id === planId);
    if (!plan) {
      navigate({ to: "/" });
      return;
    }

    // Initialize the edit state with plan data
    initializeForEdit(planId, {
      goal: plan.goal,
      emoji: plan.emoji || null,
      backgroundImageUrl: plan.backgroundImageUrl || null,
      isCoached: plan.isCoached || false,
      visibility: plan.visibility,
      finishingDate: plan.finishingDate ? new Date(plan.finishingDate) : null,
      activities: plan.activities || [],
      outlineType: plan.outlineType,
      timesPerWeek: plan.timesPerWeek || 3,
      generatedSessions: plan.sessions?.map((s) => ({
        date: new Date(s.date),
        activityId: s.activityId,
        descriptive_guide: s.descriptiveGuide || "",
        quantity: s.quantity,
      })) || [],
      milestones: plan.milestones || [],
    });

    setInitialized(true);
  }, [plans, planId, isLoadingPlans, initializeForEdit, navigate, initialized]);

  if (isLoadingPlans || !initialized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="grid grid-cols-2 gap-3 w-full max-w-lg mt-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return <EditPlanStepRenderer />;
};

function EditPlanPage() {
  const { planId } = Route.useParams();

  const initialSteps = getEditPlanSteps({
    currentStep: "overview",
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
    outlineType: "TIMES_PER_WEEK",
    timesPerWeek: 3,
    generatedSessions: [],
    milestones: [],
    description: null,
    editingPlanId: planId,
    editingSection: null,
    originalValues: null,
  });

  return (
    <PlanCreationProvider steps={initialSteps} initialStepId="overview">
      <EditPlanLoader planId={planId} />
    </PlanCreationProvider>
  );
}
