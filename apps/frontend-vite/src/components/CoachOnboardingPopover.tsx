import AppleLikePopover from "@/components/AppleLikePopover";
import { AICoachPersonalitySelector } from "@/components/AICoachPersonalitySelector";
import { CoachingTimeSelector } from "@/components/CoachingTimeSelector";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useCurrentUser } from "@/contexts/users";
import {
  getCoachAvatar,
  getCoachPersonalityConfig,
  normalizeCoachPersonality,
  type CoachPersonality,
} from "@/lib/coachPersonality";
import { cn } from "@/lib/utils";
import { getFormattedLabel } from "@/utils/coachingTime";
import { BellRing, Clock, MessageCircleOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

interface CoachOnboardingPopoverProps {
  open: boolean;
  onClose: () => void;
}

export function CoachOnboardingPopover({
  open,
  onClose,
}: CoachOnboardingPopoverProps) {
  const { currentUser, updateUser, isUpdatingUser } = useCurrentUser();
  const [coachPersonality, setCoachPersonality] = useState<CoachPersonality>(
    normalizeCoachPersonality(currentUser?.coachPersonality)
  );
  const [proactiveCoachingEnabled, setProactiveCoachingEnabled] = useState(
    currentUser?.proactiveCoachingEnabled ?? true
  );
  const [preferredCoachingHour, setPreferredCoachingHour] = useState(
    currentUser?.preferredCoachingHour ?? 6
  );
  const [showCoachingTimeSelector, setShowCoachingTimeSelector] =
    useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCoachPersonality(normalizeCoachPersonality(currentUser?.coachPersonality));
    setProactiveCoachingEnabled(currentUser?.proactiveCoachingEnabled ?? true);
    setPreferredCoachingHour(currentUser?.preferredCoachingHour ?? 6);
  }, [
    currentUser?.coachPersonality,
    currentUser?.preferredCoachingHour,
    currentUser?.proactiveCoachingEnabled,
    open,
  ]);

  const aiCoach = getCoachPersonalityConfig(coachPersonality);
  const isBusy = isSaving || isUpdatingUser;

  const completeSetup = async (enabled = proactiveCoachingEnabled) => {
    if (!currentUser) return;
    setIsSaving(true);
    try {
      await updateUser({
        updates: {
          coachPersonality,
          preferredCoachingHour,
          proactiveCoachingEnabled: enabled,
          coachOnboardingCompletedAt: new Date(),
        },
        muteNotifications: true,
      });
      toast.success(enabled ? "Coach setup saved" : "Proactive coaching turned off");
      onClose();
    } catch (error) {
      console.error("Failed to save coach setup:", error);
      toast.error("Failed to save coach setup");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCoachingTime = async (startHour: number) => {
    setPreferredCoachingHour(startHour);
  };

  return (
    <>
      <AppleLikePopover
        open={open}
        onClose={() => completeSetup(true)}
        title="Coach setup"
        className="max-w-lg"
      >
        <div className="space-y-6 pt-6 pb-2">
          <div className="text-center">
            <img
              src={getCoachAvatar(coachPersonality, "coachSmiling")}
              alt={aiCoach.label}
              className="mx-auto h-20 w-20 object-contain"
            />
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
              Set up your coach
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Your coach can watch plan progress, check in when plans need
              attention, and suggest concrete actions.
            </p>
          </div>

          <AICoachPersonalitySelector
            selectedPersonality={coachPersonality}
            onSelect={setCoachPersonality}
            disabled={isBusy}
          />

          <div className="space-y-3">
            <div
              className={cn(
                "flex w-full items-center justify-between gap-4 rounded-xl border p-4 text-left transition-colors",
                proactiveCoachingEnabled
                  ? "border-primary/40 bg-primary/10"
                  : "border-border bg-card"
              )}
            >
              <div className="flex items-start gap-3">
                <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Proactive coaching
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Let {aiCoach.name} check in, surface plan warnings, and send
                    coach actions when your plans need attention.
                  </p>
                </div>
              </div>
              <Switch
                checked={proactiveCoachingEnabled}
                onCheckedChange={setProactiveCoachingEnabled}
                disabled={isBusy}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowCoachingTimeSelector(true)}
              disabled={isBusy || !proactiveCoachingEnabled}
              className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Usually around {getFormattedLabel(preferredCoachingHour)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Prep messages and check-ins use this window when timing is
                    flexible.
                  </p>
                </div>
              </div>
            </button>
          </div>

          <div className="space-y-2">
            <Button
              className="h-12 w-full rounded-xl text-base"
              disabled={isBusy}
              onClick={() => completeSetup(proactiveCoachingEnabled)}
            >
              {isBusy ? "Saving..." : "Start with these settings"}
            </Button>
            <Button
              variant="ghost"
              className="h-11 w-full rounded-xl text-muted-foreground"
              disabled={isBusy}
              onClick={() => completeSetup(false)}
            >
              <MessageCircleOff className="mr-2 h-4 w-4" />
              Turn off proactive coaching
            </Button>
          </div>
        </div>
      </AppleLikePopover>

      <CoachingTimeSelector
        open={showCoachingTimeSelector}
        onClose={() => setShowCoachingTimeSelector(false)}
        onSave={handleSaveCoachingTime}
        currentStartHour={preferredCoachingHour}
      />
    </>
  );
}
