import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { Eye, Loader2 } from "lucide-react";
import { useState } from "react";

type SuggestedActivity = { title: string; emoji: string; measure: string };

interface CoachActivitySuggestionCardProps {
  suggestion: SuggestedActivity;
  planGoal?: string | null;
  isCreating?: boolean;
  onAccept: () => void | Promise<void>;
  onReject: () => void;
}

export function CoachActivitySuggestionCard({
  suggestion,
  planGoal,
  isCreating = false,
  onAccept,
  onReject,
}: CoachActivitySuggestionCardProps) {
  const themeColors = useThemeColors();
  const [open, setOpen] = useState(false);

  const handleAccept = async () => {
    await onAccept();
    setOpen(false);
  };

  const handleReject = () => {
    onReject();
    setOpen(false);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "flex items-center w-full rounded-lg border-2 border-dashed p-3 transition-all",
          themeColors.border,
          themeColors.veryFadedBg
        )}
      >
        <span className="text-3xl mr-3">{suggestion.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-sm font-semibold">{suggestion.title}</span>
            <span className="text-xs text-muted-foreground">
              ({suggestion.measure})
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            New activity suggestion
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={isCreating}
          aria-label={`Review ${suggestion.title} suggestion`}
          className={cn(
            "p-2 rounded-full transition-colors disabled:pointer-events-none disabled:opacity-50",
            themeColors.text,
            themeColors.hover
          )}
        >
          {isCreating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      </div>

      <DrawerContent className="px-4 pb-4">
        <DrawerHeader className="px-0 text-left">
          <DrawerTitle>Review activity suggestion</DrawerTitle>
          <DrawerDescription>
            Coach thinks this activity belongs well in the plan
            {planGoal ? ` "${planGoal}"` : ""}.
          </DrawerDescription>
        </DrawerHeader>

        <div
          className={cn(
            "rounded-lg border p-4",
            themeColors.brightBorder,
            themeColors.veryFadedBg
          )}
        >
          <div className="flex items-center gap-3">
            <span className="text-4xl">{suggestion.emoji}</span>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{suggestion.title}</p>
              <p className="text-sm text-muted-foreground">
                Measured in {suggestion.measure}
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Accepting will create it as a new activity and add it to this plan.
          </p>
        </div>

        <DrawerFooter className="px-0 pt-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleReject}
              disabled={isCreating}
            >
              Reject
            </Button>
            <Button
              type="button"
              onClick={handleAccept}
              disabled={isCreating}
              loading={isCreating}
              className={themeColors.button.solid}
            >
              Accept
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
