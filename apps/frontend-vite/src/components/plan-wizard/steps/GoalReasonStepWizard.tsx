import { useApiWithAuth } from "@/api";
import { Button } from "@/components/ui/button";
import { TextAreaWithVoice } from "@/components/ui/text-area-with-voice";
import { usePlanCreation } from "@/contexts/plan-creation";
import { withFadeUpAnimation } from "@/contexts/plan-creation/lib";
import { cn } from "@/lib/utils";
import { Heart, Loader2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";

const OTHER_KEY = "__other__";

const GoalReasonStepWizard = () => {
  const { goal, emoji, setGoalReason, completeStep } = usePlanCreation();
  const api = useApiWithAuth();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [customReason, setCustomReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!goal) return;
    api
      .post("/onboarding/suggest-goal-reasons", { goal })
      .then((res) => setSuggestions(res.data.reasons || []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [goal]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const pos = prev.indexOf(key);
      if (pos >= 0) return prev.filter((k) => k !== key);
      return [...prev, key];
    });
  };

  const showOther = selected.includes(OTHER_KEY);

  const buildReason = () => {
    const parts = selected
      .filter((k) => k !== OTHER_KEY)
      .map((k) => suggestions[Number(k)]);
    if (showOther && customReason.trim()) parts.splice(selected.indexOf(OTHER_KEY), 0, customReason.trim());
    return parts.join(". ") || null;
  };

  const buildDiscarded = () => {
    const pickedIndices = new Set(selected.filter((k) => k !== OTHER_KEY).map(Number));
    return suggestions.filter((_, i) => !pickedIndices.has(i));
  };

  const handleSubmit = () => {
    const reason = buildReason();
    const discarded = buildDiscarded();
    setGoalReason(reason);
    completeStep("goal-reason", {
      goalReason: reason,
      ...(discarded.length > 0 ? { description: `Suggested reasons not selected: ${discarded.join("; ")}` } : {}),
    });
  };

  const handleSkip = () => {
    setGoalReason(null);
    completeStep("goal-reason", {
      goalReason: null,
      ...(suggestions.length > 0 ? { description: `Suggested reasons not selected (skipped): ${suggestions.join("; ")}` } : {}),
    });
  };

  const hasSelection = selected.length > 0 && (!showOther || selected.length > 1 || customReason.trim());

  return (
    <div className="flex flex-col items-center text-center space-y-6">
      <Heart className="w-16 h-16 text-blue-600" />

      <div>
        <h2 className="text-2xl font-bold">Why does this matter to you?</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Understanding your motivation helps us keep you on track
        </p>
      </div>

      {goal && (
        <div className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2">
          {emoji && <span className="text-2xl">{emoji}</span>}
          <span className="text-sm font-medium">{goal}</span>
        </div>
      )}

      {isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      ) : (
        <div className="w-full space-y-2">
          {suggestions.map((reason, i) => {
            const key = String(i);
            const order = selected.indexOf(key);
            const isSelected = order >= 0;
            return (
              <button
                key={i}
                onClick={() => toggle(key)}
                className={cn(
                  "w-full p-3 rounded-xl border-2 text-left transition-all text-sm flex items-center gap-3",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:bg-accent/50"
                )}
              >
                <span
                  className={cn(
                    "flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-all",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isSelected ? order + 1 : ""}
                </span>
                <span className="flex-1">{reason}</span>
              </button>
            );
          })}

          <button
            onClick={() => toggle(OTHER_KEY)}
            className={cn(
              "w-full p-3 rounded-xl border-2 text-left transition-all text-sm flex items-center gap-3",
              showOther
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:bg-accent/50"
            )}
          >
            <span
              className={cn(
                "flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-all",
                showOther ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {showOther ? selected.indexOf(OTHER_KEY) + 1 : <Pencil className="w-3 h-3" />}
            </span>
            <span className="flex-1">Other</span>
          </button>

          {showOther && (
            <TextAreaWithVoice
              value={customReason}
              onChange={setCustomReason}
              placeholder="Describe your reason..."
              className="min-h-[80px] text-sm"
            />
          )}
        </div>
      )}

      <div className="w-full space-y-3">
        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={!hasSelection}
        >
          Continue
        </Button>
        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={handleSkip}
        >
          Skip for now
        </Button>
      </div>
    </div>
  );
};

export default withFadeUpAnimation(GoalReasonStepWizard);
