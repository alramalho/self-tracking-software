import { useState } from "react";
import { toast } from "react-hot-toast";
import { ChevronRight, Clock } from "lucide-react";
import AppleLikePopover from "@/components/AppleLikePopover";
import { AICoachPersonalitySelector } from "@/components/AICoachPersonalitySelector";
import { CoachingTimeSelector } from "@/components/CoachingTimeSelector";
import { useCurrentUser } from "@/contexts/users";
import { getCoachPersonalityConfig, normalizeCoachPersonality, type CoachPersonality } from "@/lib/coachPersonality";
import { getFormattedLabel } from "@/utils/coachingTime";
import type { CoachSettingsProps } from "./types";

// Which coach you talk to and when it usually reaches out. Opened from the coach card on the
// Coach tab, like the iPhone app.
export function CoachSettings({ open, onClose }: CoachSettingsProps) {
  const { currentUser, updateUser, isUpdatingUser } = useCurrentUser();
  const hour = currentUser?.preferredCoachingHour ?? 6;
  const [pickingTime, setPickingTime] = useState(false);

  const chooseCoach = async (coachPersonality: CoachPersonality) => {
    try {
      await updateUser({ updates: { coachPersonality }, muteNotifications: true });
      toast.success(`Switched to ${getCoachPersonalityConfig(coachPersonality).name}`);
    } catch {
      toast.error("Failed to update coach");
    }
  };

  const saveHour = async (preferredCoachingHour: number) => {
    try {
      await updateUser({ updates: { preferredCoachingHour }, muteNotifications: true });
    } catch (error) {
      toast.error("Failed to update reachout time");
      throw error;
    }
  };

  return (
    <>
      <AppleLikePopover open={open} onClose={onClose} title="Coach settings">
        <div className="flex flex-col gap-4 pt-10" data-testid="coach-settings-sheet">
          <AICoachPersonalitySelector
            hideHeader
            selectedPersonality={normalizeCoachPersonality(currentUser?.coachPersonality)}
            onSelect={chooseCoach}
            disabled={isUpdatingUser}
          />
          <button
            type="button"
            onClick={() => setPickingTime(true)}
            className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-opacity hover:opacity-70"
          >
            <Clock className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">Reachout time</span>
              <span className="block text-[13px] text-muted-foreground">Usually around {getFormattedLabel(hour)}</span>
            </span>
            <ChevronRight className="h-[18px] w-[18px] text-muted-foreground" />
          </button>
        </div>
      </AppleLikePopover>
      <CoachingTimeSelector
        open={pickingTime}
        onClose={() => setPickingTime(false)}
        onSave={saveHour}
        currentStartHour={hour}
      />
    </>
  );
}
