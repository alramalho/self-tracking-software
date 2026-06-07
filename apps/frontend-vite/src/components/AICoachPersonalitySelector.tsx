import { cn } from "@/lib/utils";
import {
  coachPersonalityOptions,
  type CoachPersonality,
} from "@/lib/coachPersonality";
import { Check, MessageCircleOff } from "lucide-react";

type AICoachPersonalitySelectorProps = {
  selectedPersonality?: CoachPersonality | null;
  onSelect: (personality: CoachPersonality) => void;
  disabled?: boolean;
  hideHeader?: boolean;
  optOutSelected?: boolean;
  onSelectOptOut?: () => void;
};

export function AICoachPersonalitySelector({
  selectedPersonality,
  onSelect,
  disabled = false,
  hideHeader = false,
  optOutSelected = false,
  onSelectOptOut,
}: AICoachPersonalitySelectorProps) {
  const cardClassName = (selected: boolean, selectedClassName?: string) =>
    cn(
      "relative flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all hover:border-blue-500 disabled:cursor-not-allowed disabled:opacity-70",
      selected ? selectedClassName || "border-primary bg-primary/10" : "border-border bg-card"
    );

  return (
    <div className="space-y-3">
      {!hideHeader && (
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Choose your AI coach
          </h2>
          <p className="text-sm text-muted-foreground">
            What kind of coach helps you follow through?
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {coachPersonalityOptions.map((coach) => {
          const selected = selectedPersonality === coach.id;

          return (
            <button
              key={coach.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(coach.id)}
              className={cardClassName(selected, coach.accentClassName)}
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

        {onSelectOptOut ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onSelectOptOut}
            className={cardClassName(optOutSelected, "border-muted-foreground/60 bg-muted/70")}
          >
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-background/80">
              <MessageCircleOff className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">
                  No proactive coaching
                </h3>
                {optOutSelected && <Check className="h-4 w-4 text-blue-500" />}
              </div>
              <p className="mt-1 text-sm font-medium text-foreground">
                I don't want coaching check-ins
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Keep the coach available in chat, but do not surface plan
                updates, notifications, or coach actions.
              </p>
            </div>
          </button>
        ) : null}
      </div>
    </div>
  );
}
