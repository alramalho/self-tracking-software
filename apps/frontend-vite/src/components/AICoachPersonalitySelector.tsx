import { cn } from "@/lib/utils";
import {
  coachPersonalityOptions,
  type CoachPersonality,
} from "@/lib/coachPersonality";
import { Check } from "lucide-react";

type AICoachPersonalitySelectorProps = {
  selectedPersonality: CoachPersonality;
  onSelect: (personality: CoachPersonality) => void;
  disabled?: boolean;
};

export function AICoachPersonalitySelector({
  selectedPersonality,
  onSelect,
  disabled = false,
}: AICoachPersonalitySelectorProps) {
  return (
    <div className="space-y-3">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Choose your AI coach
        </h2>
        <p className="text-sm text-muted-foreground">
          What kind of coach helps you follow through?
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {coachPersonalityOptions.map((coach) => {
          const selected = selectedPersonality === coach.id;

          return (
            <button
              key={coach.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(coach.id)}
              className={cn(
                "relative flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all hover:border-blue-500 disabled:cursor-not-allowed disabled:opacity-70",
                selected ? coach.accentClassName : "border-border bg-card"
              )}
            >
              <img
                src={coach.avatar}
                alt={coach.label}
                className="h-20 w-20 shrink-0 rounded-full object-contain"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">
                    {coach.label}
                  </h3>
                  {selected && <Check className="h-4 w-4 text-blue-500" />}
                </div>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {coach.shortChoice}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {coach.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
