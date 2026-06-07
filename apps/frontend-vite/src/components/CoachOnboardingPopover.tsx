import AppleLikePopover from "@/components/AppleLikePopover";
import { AICoachPersonalitySelector } from "@/components/AICoachPersonalitySelector";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/contexts/users";
import {
  getCoachAvatar,
  getCoachPersonalityConfig,
  normalizeCoachPersonality,
  type CoachPersonality,
} from "@/lib/coachPersonality";
import { cn } from "@/lib/utils";
import { getFormattedLabel, TIME_PERIODS } from "@/utils/coachingTime";
import { AnimatePresence, motion } from "framer-motion";
import { BellRing, Check, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

interface CoachOnboardingPopoverProps {
  open: boolean;
  onClose: () => void;
}

type SetupStep = 0 | 1 | 2;

const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

export function CoachOnboardingPopover({
  open,
  onClose,
}: CoachOnboardingPopoverProps) {
  const { currentUser, updateUser, isUpdatingUser } = useCurrentUser();
  const [step, setStep] = useState<SetupStep>(0);
  const [direction, setDirection] = useState(1);
  const [coachPersonality, setCoachPersonality] = useState<CoachPersonality>(
    normalizeCoachPersonality(currentUser?.coachPersonality)
  );
  const [proactiveCoachingEnabled, setProactiveCoachingEnabled] = useState(
    currentUser?.proactiveCoachingEnabled ?? true
  );
  const [preferredCoachingHour, setPreferredCoachingHour] = useState(
    currentUser?.preferredCoachingHour ?? 6
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setDirection(1);
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

  const goToStep = (nextStep: SetupStep) => {
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
  };

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

  const selectCoach = (personality: CoachPersonality) => {
    setCoachPersonality(personality);
    setProactiveCoachingEnabled(true);
  };

  const selectOptOut = () => {
    setProactiveCoachingEnabled(false);
  };

  const handlePrimaryAction = () => {
    if (step === 0) {
      if (!proactiveCoachingEnabled) {
        completeSetup(false);
        return;
      }
      goToStep(1);
      return;
    }

    if (step === 1) {
      goToStep(2);
      return;
    }

    completeSetup(true);
  };

  const primaryLabel = (() => {
    if (isBusy) return "Saving...";
    if (step === 0 && !proactiveCoachingEnabled) return "Finish without check-ins";
    if (step === 2) return "Finish setup";
    return "Continue";
  })();

  return (
    <AppleLikePopover
      open={open}
      onClose={() => completeSetup(proactiveCoachingEnabled)}
      title="Coach setup"
      className="max-w-lg overflow-hidden"
    >
      <div className="px-1 pt-6 pb-2">
        <div className="mx-auto mb-5 flex w-full max-w-xs items-center gap-2">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                index <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        <div className="text-center">
          <img
            src={getCoachAvatar(coachPersonality, "coachSmiling")}
            alt={aiCoach.label}
            className="mx-auto h-20 w-20 object-contain"
          />
        </div>

        <div className="relative mt-4 min-h-[430px] overflow-hidden">
          <AnimatePresence initial={false} mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 32 },
                opacity: { duration: 0.16 },
              }}
              className="w-full"
            >
              {step === 0 ? (
                <div className="space-y-5">
                  <div className="text-center">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      1 of 3
                    </p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                      Choose your coach
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Pick the coaching style you want, or keep the coach quiet
                      unless you start the conversation.
                    </p>
                  </div>

                  <AICoachPersonalitySelector
                    selectedPersonality={
                      proactiveCoachingEnabled ? coachPersonality : null
                    }
                    onSelect={selectCoach}
                    disabled={isBusy}
                    hideHeader
                    optOutSelected={!proactiveCoachingEnabled}
                    onSelectOptOut={selectOptOut}
                  />
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-5">
                  <div className="text-center">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      2 of 3
                    </p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                      Choose check-in time
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {aiCoach.name} will use this window for plan updates and
                      check-ins when timing is flexible.
                    </p>
                  </div>

                  <div className="max-h-[330px] space-y-4 overflow-y-auto pr-1">
                    {TIME_PERIODS.map((period) => (
                      <div key={period.label} className="space-y-2">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                          {period.label}
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                          {period.intervals.map((interval) => {
                            const selected =
                              preferredCoachingHour === interval.startHour;

                            return (
                              <button
                                key={interval.startHour}
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  setPreferredCoachingHour(interval.startHour)
                                }
                                className={cn(
                                  "flex items-center justify-between rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-70",
                                  selected
                                    ? "border-primary bg-primary/10"
                                    : "border-border bg-card hover:bg-accent/50"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-semibold text-foreground">
                                    {interval.label}
                                  </span>
                                </div>
                                {selected ? (
                                  <Check className="h-4 w-4 text-primary" />
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-5">
                  <div className="text-center">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      3 of 3
                    </p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                      Ready to start
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {aiCoach.name} can watch plan progress, surface plan
                      updates, and suggest concrete actions.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-border bg-card p-4">
                      <p className="text-sm font-semibold text-foreground">
                        {aiCoach.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {aiCoach.description}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <BellRing className="mt-0.5 h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Proactive coaching is on
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Usually around{" "}
                            {getFormattedLabel(preferredCoachingHour)}.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-5 space-y-2">
          <Button
            className="h-12 w-full rounded-xl text-base"
            disabled={isBusy}
            onClick={handlePrimaryAction}
          >
            {primaryLabel}
          </Button>
          {step > 0 ? (
            <Button
              variant="ghost"
              className="h-11 w-full rounded-xl text-muted-foreground"
              disabled={isBusy}
              onClick={() => goToStep((step - 1) as SetupStep)}
            >
              Back
            </Button>
          ) : null}
        </div>
      </div>
    </AppleLikePopover>
  );
}
