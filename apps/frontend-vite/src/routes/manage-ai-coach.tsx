import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { ArrowLeft, CalendarCheck, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AICoachPersonalitySelector } from "@/components/AICoachPersonalitySelector";
import { CoachingTimeSelector } from "@/components/CoachingTimeSelector";
import { Switch } from "@/components/ui/switch";
import { useCurrentUser } from "@/contexts/users";
import {
  getCoachPersonalityConfig,
  normalizeCoachPersonality,
  type CoachPersonality,
} from "@/lib/coachPersonality";
import { cn } from "@/lib/utils";
import { getFormattedLabel } from "@/utils/coachingTime";

export const Route = createFileRoute("/manage-ai-coach")({
  component: ManageAICoachPage,
});

function ManageAICoachPage() {
  const navigate = useNavigate();
  const { currentUser, updateUser, isUpdatingUser } = useCurrentUser();
  const aiCoach = getCoachPersonalityConfig(currentUser?.coachPersonality);
  const preferredCoachingHour = currentUser?.preferredCoachingHour ?? 6;
  const proactiveCoachingEnabled =
    currentUser?.proactiveCoachingEnabled ?? true;
  const [showCoachingTimeSelector, setShowCoachingTimeSelector] =
    useState(false);

  const handleCoachPersonalityChange = async (
    coachPersonality: CoachPersonality
  ) => {
    try {
      await updateUser({
        updates: { coachPersonality },
        muteNotifications: true,
      });
      toast.success(
        `Switched to ${getCoachPersonalityConfig(coachPersonality).name}`
      );
    } catch {
      toast.error("Failed to update coach");
    }
  };

  const handleSaveCoachingTime = async (startHour: number) => {
    try {
      await updateUser({
        updates: { preferredCoachingHour: startHour },
        muteNotifications: true,
      });
      toast.success("Coaching time updated");
    } catch (error) {
      console.error("Failed to update coaching time:", error);
      toast.error("Failed to update coaching time");
      throw error;
    }
  };

  const handleProactiveCoachingChange = async (enabled: boolean) => {
    try {
      await updateUser({
        updates: { proactiveCoachingEnabled: enabled },
        muteNotifications: true,
      });
      toast.success(
        enabled ? "Proactive coaching enabled" : "Proactive coaching disabled"
      );
    } catch (error) {
      console.error("Failed to update proactive coaching:", error);
      toast.error("Failed to update proactive coaching");
      throw error;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex-shrink-0 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="w-full max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate({ to: "/message-ai" })}
            >
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="font-semibold text-foreground">{aiCoach.name}</h1>
              <p className="text-xs text-muted-foreground">Settings</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              How coaching works
            </h2>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <CalendarCheck
                size={20}
                className="text-muted-foreground mt-0.5 shrink-0"
              />
              <p className="text-sm text-muted-foreground">
                Once a week, your coach recaps the week you finished and lays
                out the week ahead in one message.
              </p>
            </div>
          </div>

          <AICoachPersonalitySelector
            selectedPersonality={normalizeCoachPersonality(
              currentUser?.coachPersonality
            )}
            onSelect={handleCoachPersonalityChange}
            disabled={isUpdatingUser}
          />

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Proactive coaching
            </h2>
            <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <Send
                  size={20}
                  className="text-muted-foreground mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Weekly recap
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    One message every Monday. There are no activity-by-activity
                    or midweek check-ins.
                  </p>
                </div>
              </div>
              <Switch
                checked={proactiveCoachingEnabled}
                onCheckedChange={handleProactiveCoachingChange}
                disabled={isUpdatingUser}
              />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Reachout time
            </h2>
            <button
              type="button"
              onClick={() => setShowCoachingTimeSelector(true)}
              className={cn(
                "w-full rounded-lg bg-muted/50 p-4 text-left",
                "border border-transparent transition-colors hover:bg-accent/60"
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Clock
                    size={20}
                    className="text-muted-foreground mt-0.5 shrink-0"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Usually around {getFormattedLabel(preferredCoachingHour)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your Monday recap uses this window.
                    </p>
                  </div>
                </div>
                <Send size={18} className="text-muted-foreground shrink-0" />
              </div>
            </button>
          </div>
        </div>
      </div>

      <CoachingTimeSelector
        open={showCoachingTimeSelector}
        onClose={() => setShowCoachingTimeSelector(false)}
        onSave={handleSaveCoachingTime}
        currentStartHour={preferredCoachingHour}
      />
    </div>
  );
}
