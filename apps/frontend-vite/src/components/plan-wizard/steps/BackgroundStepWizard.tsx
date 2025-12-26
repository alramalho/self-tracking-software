import { usePlanCreation } from "@/contexts/plan-creation";
import { withFadeUpAnimation } from "@/contexts/plan-creation/lib";
import { Button } from "@/components/ui/button";
import PhotoUploader from "@/components/ui/PhotoUploader";
import { usePlans } from "@/contexts/plans";
import { useNavigate } from "@tanstack/react-router";
import useConfetti from "@/hooks/useConfetti";
import { ImageIcon, X, Loader2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

const BackgroundStepWizard = () => {
  const {
    goal,
    emoji,
    backgroundImageUrl,
    backgroundImageFile,
    isCoached,
    selectedCoachId,
    visibility,
    finishingDate,
    activities,
    outlineType,
    timesPerWeek,
    generatedSessions,
    milestones,
    isEditMode,
    setBackgroundImageUrl,
    setBackgroundImageFile,
    completeStep,
    resetState,
  } = usePlanCreation();

  const { upsertPlan, uploadPlanBackgroundImage, isUpsertingPlan } = usePlans();
  const navigate = useNavigate();
  const { sideCannons } = useConfetti();
  const [isSaving, setIsSaving] = useState(false);

  const handleFileSelect = (file: File) => {
    setBackgroundImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setBackgroundImageUrl(previewUrl);
  };

  const handleRemove = () => {
    setBackgroundImageFile(null);
    setBackgroundImageUrl(null);
  };

  const handleContinue = () => {
    // In edit mode, just go back to overview
    if (isEditMode) {
      completeStep("background");
      return;
    }

    // In create mode, create the plan
    handleCreatePlan();
  };

  const handleCreatePlan = async () => {
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
        coachId: selectedCoachId || null,
        activities,
        sessions,
        milestones: milestones.filter((m) => m.description?.trim()),
      };

      await upsertPlan({
        planId: "",
        updates: planData,
        muteNotifications: true,
      });

      // Success!
      sideCannons({ duration: 500 });
      toast.success("Plan created successfully!");
      resetState();
      navigate({ to: "/" });
    } catch (error) {
      console.error("Failed to create plan:", error);
      toast.error("Failed to create plan. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const isCreating = isSaving || isUpsertingPlan;

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <ImageIcon className="w-16 h-16 text-blue-600" />
          <h2 className="text-2xl mt-2 font-bold tracking-tight text-foreground">
            Add a cover image
          </h2>
        </div>
        <p className="text-md text-muted-foreground">
          Personalize your plan with a background image (optional)
        </p>
      </div>

      <div className="space-y-4 px-2">
        <PhotoUploader
          onFileSelect={handleFileSelect}
          currentImageUrl={backgroundImageUrl || undefined}
          placeholder="Click to upload a background image"
          className="w-full"
        />
        {backgroundImageUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRemove}
            className="w-full"
            disabled={isCreating}
          >
            <X className="h-4 w-4 mr-2" />
            Remove background image
          </Button>
        )}
      </div>

      <div className="px-2">
        <Button onClick={handleContinue} className="w-full" disabled={isCreating}>
          {isCreating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Creating Plan...
            </>
          ) : isEditMode ? (
            backgroundImageUrl ? "Save & Return" : "Skip & Return"
          ) : (
            "Create Plan"
          )}
        </Button>
      </div>
    </div>
  );
};

export default withFadeUpAnimation(BackgroundStepWizard);
