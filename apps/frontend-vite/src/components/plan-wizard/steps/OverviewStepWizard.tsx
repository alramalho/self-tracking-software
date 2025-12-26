import { usePlanCreation } from "@/contexts/plan-creation";
import { withFadeUpAnimation } from "@/contexts/plan-creation/lib";
import { Button } from "@/components/ui/button";
import { usePlans } from "@/contexts/plans";
import { useNavigate } from "@tanstack/react-router";
import useConfetti from "@/hooks/useConfetti";
import {
  Goal,
  Smile,
  ImageIcon,
  Eye,
  Calendar,
  Dumbbell,
  Flag,
  CalendarCheck,
  Users,
  Loader2,
  Pencil,
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { format } from "date-fns";

interface OverviewCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
  onClick: () => void;
}

const OverviewCard = ({ icon, label, value, onClick }: OverviewCardProps) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-foreground/30 hover:bg-muted/50 transition-all text-left w-full group bg-card"
  >
    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted/50 shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium truncate">{value}</p>
    </div>
    <Pencil className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
  </button>
);

const OverviewStepWizard = () => {
  const {
    goal,
    emoji,
    backgroundImageUrl,
    backgroundImageFile,
    isCoached,
    selectedCoach,
    visibility,
    finishingDate,
    activities,
    outlineType,
    timesPerWeek,
    generatedSessions,
    milestones,
    editingPlanId,
    goToStep,
    resetState,
  } = usePlanCreation();

  const { upsertPlan, uploadPlanBackgroundImage, isUpsertingPlan } = usePlans();
  const navigate = useNavigate();
  const { sideCannons } = useConfetti();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Upload background image if needed
      let finalBackgroundImageUrl = backgroundImageUrl;
      if (backgroundImageFile) {
        try {
          const uploadedUrl = await uploadPlanBackgroundImage(backgroundImageFile);
          finalBackgroundImageUrl = uploadedUrl;
        } catch (error) {
          console.error("Failed to upload background image:", error);
        }
      }

      // Build sessions based on outline type
      const sessions = outlineType === "SPECIFIC" ? generatedSessions : [];

      // Build the plan object
      const planData = {
        goal: goal || "",
        emoji: emoji || undefined,
        finishingDate: finishingDate || null,
        visibility,
        backgroundImageUrl: finalBackgroundImageUrl || null,
        outlineType,
        timesPerWeek: outlineType === "TIMES_PER_WEEK" ? timesPerWeek : null,
        isCoached,
        activities,
        sessions,
        milestones: milestones.filter((m) => m.description?.trim()),
      };

      await upsertPlan({
        planId: editingPlanId || "",
        updates: planData,
        muteNotifications: true,
      });

      // Success!
      if (!editingPlanId) {
        sideCannons({ duration: 500 });
      }
      toast.success(editingPlanId ? "Plan updated!" : "Plan created!");
      resetState();
      navigate({ to: "/" });
    } catch (error) {
      console.error("Failed to save plan:", error);
      toast.error("Failed to save plan. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const isCreating = isSaving || isUpsertingPlan;

  const visibilityLabels: Record<string, string> = {
    PUBLIC: "Public",
    PRIVATE: "Private",
    FRIENDS: "Friends only",
  };

  return (
    <div className="w-full max-w-lg flex flex-col h-[calc(100dvh-140px)]">
      {/* Header */}
      <div className="flex flex-col items-center gap-2 text-center pb-4 shrink-0">
        {emoji && <span className="text-6xl">{emoji}</span>}
        <h2 className="text-2xl mt-2 font-bold tracking-tight text-foreground">
          {editingPlanId ? "Edit Plan" : "Review Your Plan"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Tap any section to edit
        </p>
      </div>

      {/* Scrollable cards area */}
      <div className="flex-1 overflow-y-auto px-2 space-y-2 pb-4 min-h-0">
        <OverviewCard
          icon={<Goal className="w-5 h-5 text-muted-foreground" />}
          label="Goal"
          value={goal || "Not set"}
          onClick={() => goToStep("goal")}
        />
        <OverviewCard
          icon={<Smile className="w-5 h-5 text-muted-foreground" />}
          label="Emoji"
          value={emoji ? <span className="text-2xl">{emoji}</span> : "Not set"}
          onClick={() => goToStep("emoji")}
        />
        <OverviewCard
          icon={<CalendarCheck className="w-5 h-5 text-muted-foreground" />}
          label="Frequency"
          value={timesPerWeek ? `${timesPerWeek}x per week` : "Not set"}
          onClick={() => goToStep("times-per-week")}
        />
        <OverviewCard
          icon={<Users className="w-5 h-5 text-muted-foreground" />}
          label="Coaching"
          value={
            isCoached
              ? selectedCoach
                ? selectedCoach.name || selectedCoach.username
                : "AI Coach"
              : "Self-guided"
          }
          onClick={() => goToStep("coaching")}
        />
        <OverviewCard
          icon={<Eye className="w-5 h-5 text-muted-foreground" />}
          label="Visibility"
          value={visibilityLabels[visibility] || visibility}
          onClick={() => goToStep("visibility")}
        />
        <OverviewCard
          icon={<Calendar className="w-5 h-5 text-muted-foreground" />}
          label="Duration"
          value={finishingDate ? format(new Date(finishingDate), "MMM d, yyyy") : "No end date"}
          onClick={() => goToStep("duration")}
        />
        <OverviewCard
          icon={<Dumbbell className="w-5 h-5 text-muted-foreground" />}
          label="Activities"
          value={activities.length > 0 ? `${activities.length} selected` : "None"}
          onClick={() => goToStep("activities")}
        />
        <OverviewCard
          icon={<Flag className="w-5 h-5 text-muted-foreground" />}
          label="Milestones"
          value={milestones.length > 0 ? `${milestones.length} milestones` : "None"}
          onClick={() => goToStep("milestones")}
        />
        <OverviewCard
          icon={<ImageIcon className="w-5 h-5 text-muted-foreground" />}
          label="Cover Image"
          value={backgroundImageUrl ? "Image set" : "No image"}
          onClick={() => goToStep("background")}
        />
      </div>

      {/* Sticky footer */}
      <div className="px-2 pt-4 pb-2 border-t border-border bg-background">
        <Button onClick={handleSave} className="w-full" disabled={isCreating || !goal}>
          {isCreating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {editingPlanId ? "Saving..." : "Creating..."}
            </>
          ) : editingPlanId ? (
            "Save Changes"
          ) : (
            "Create Plan"
          )}
        </Button>
        {!goal && (
          <p className="text-sm text-muted-foreground text-center mt-2">
            Set a goal to continue
          </p>
        )}
      </div>
    </div>
  );
};

export default withFadeUpAnimation(OverviewStepWizard);
