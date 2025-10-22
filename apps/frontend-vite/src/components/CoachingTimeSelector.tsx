import { useTheme } from "@/contexts/theme/useTheme";
import { cn } from "@/lib/utils";
import { TIME_PERIODS } from "@/utils/coachingTime";
import { Check } from "lucide-react";
import { useState } from "react";
import AppleLikePopover from "./AppleLikePopover";
import { Button } from "./ui/button";
import jarvisLogoLight from "@/assets/icons/jarvis_logo_transparent.png";
import jarvisLogoDark from "@/assets/icons/jarvis_logo_white_transparent.png";

interface CoachingTimeSelectorProps {
  open: boolean;
  onClose: () => void;
  onSave: (startHour: number) => Promise<void>;
  currentStartHour: number;
}

export function CoachingTimeSelector({
  open,
  onClose,
  onSave,
  currentStartHour,
}: CoachingTimeSelectorProps) {
  const [selectedHour, setSelectedHour] = useState(currentStartHour);
  const [isSaving, setIsSaving] = useState(false);
  const { isLightMode } = useTheme();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(selectedHour);
      onClose();
    } catch (error) {
      console.error("Failed to save coaching time:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppleLikePopover
      className="bg-muted"
      open={open}
      onClose={onClose}
      title="Coaching Time"
    >
      <div className="flex flex-col gap-4 p-4">
        <div className="text-center mb-2 mt-4">
          <div className="flex justify-center mb-3">
            <img
              src={isLightMode ? jarvisLogoLight : jarvisLogoDark}
              alt="Coach Oli"
              className="h-16 w-16"
            />
          </div>
          <h3 className="text-lg font-semibold">Daily Coaching Time</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Choose when you'd like to receive your daily coaching message
          </p>
        </div>

        <div className="flex flex-col gap-6 max-h-[60vh] overflow-y-auto">
          {TIME_PERIODS.map((period) => (
            <div key={period.label} className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {period.label}
              </span>
              <div className="grid grid-cols-1 gap-2">
                {period.intervals.map((interval) => {
                  const isSelected = selectedHour === interval.startHour;
                  return (
                    <button
                      key={interval.startHour}
                      onClick={() => setSelectedHour(interval.startHour)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-all",
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:bg-accent"
                      )}
                    >
                      <span
                        className={cn(
                          "text-sm font-medium",
                          isSelected ? "text-primary" : "text-foreground"
                        )}
                      >
                        {interval.label}
                      </span>
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 mt-4">
          <Button
            onClick={handleSave}
            disabled={isSaving || selectedHour === currentStartHour}
            className="w-full"
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </div>
    </AppleLikePopover>
  );
}
